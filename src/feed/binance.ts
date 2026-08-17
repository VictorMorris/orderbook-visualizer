import { DepthBook } from './depthBook';
import type { DepthDiff, DepthSnapshot } from './types';

export interface FeedOpts {
  symbol: string;
}

// Endpoints
//   WS:   wss://data-stream.binance.vision/ws/<symbol>@depth
//   REST: https://data-api.binance.vision/api/v3/depth?symbol=<SYMBOL>&limit=1000

export function startBinanceFeed(book: DepthBook, opts: FeedOpts): () => void {
  // Buffering: Queuing new events while waiting for the full snapshot
  // Live: New events get added straight to the depthBook
  let phase: 'buffering' | 'live' = 'buffering';
  const buffer: DepthDiff[] = [];
  let lastUpdateId = 0;                 // u of the most recently applied event
  let resyncTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  // Socket must be opened before the snapshot is fetched
  // Open, buffer, then snapshot or there is an unbridgable gap
  const socket = new WebSocket(`wss://data-stream.binance.vision/ws/${opts.symbol}@depth`);

  socket.addEventListener('message', (event) => {
    const diff = JSON.parse(event.data) as DepthDiff;
    if (phase === 'buffering') {
      buffer.push(diff);
      return;
    }
    if (diff.u <= lastUpdateId) return;              // stale duplicate, already applied
    if (diff.U > lastUpdateId + 1) return resync();  // gap, we missed events, rebuild
    book.applyDiff(diff.b, diff.a);
    lastUpdateId = diff.u;
  });

  socket.addEventListener('error', (event) => console.error('feed socket error', event));

  // Pull a fresh snapshot and stitch the buffered diffs onto it.
  function sync(): void {
    fetchSnapshot(opts.symbol).then(replay).catch((err) => {
      if (stopped) return;
      console.error('snapshot fetch failed, retrying', err);
      scheduleResync();
    });
  }

  // Adds missed buffered events to book
  // Drops stale events, validates the overlap, resets the book to snapshot, then applies the rest
  function replay(snap: DepthSnapshot): void {
    if (stopped) return;
    while (buffer.length > 0 && buffer[0].u <= snap.lastUpdateId) buffer.shift();  // drop events already in snapshot
    const first = buffer[0];
    // The first buffered event must be U <= lastUpdateId + 1 <= u
    // Else events are missing between the snapshot and the buffer
    if (first && !(first.U <= snap.lastUpdateId + 1 && snap.lastUpdateId + 1 <= first.u)) {
      resync();                                      // snapshot older than our buffer, fetch a newer one
      return;
    }
    book.reset(snap.bids, snap.asks);
    lastUpdateId = snap.lastUpdateId;
    while (buffer.length > 0) {
      const diff = buffer.shift()!;
      book.applyDiff(diff.b, diff.a);
      lastUpdateId = diff.u;
    }
    phase = 'live';
  }

  // discards the buffer, return to buffering, and fetch new snapshot
  function resync(): void {
    phase = 'buffering';
    buffer.length = 0;
    sync();
  }

  // Fixed 1s retry
  function scheduleResync(): void {
    resyncTimer = setTimeout(resync, 1000);         
  }

  sync();

  return () => {
    stopped = true;
    clearTimeout(resyncTimer);
    socket.close();
  };
}

async function fetchSnapshot(symbol: string): Promise<DepthSnapshot> {
  const url = `https://data-api.binance.vision/api/v3/depth?symbol=${symbol.toUpperCase()}&limit=1000`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`snapshot ${response.status}: ${await response.text()}`);
  return await response.json() as DepthSnapshot;
}
