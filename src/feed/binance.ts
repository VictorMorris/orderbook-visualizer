import { DepthBook } from './depthBook';
import type { DepthDiff, DepthSnapshot } from './types';

export interface FeedOpts {
  symbol: string;
}

// Endpoints
//   WS:   wss://data-stream.binance.vision/ws/<symbol>@depth
//   REST: https://data-api.binance.vision/api/v3/depth?symbol=<SYMBOL>&limit=1000

export function startBinanceFeed(book: DepthBook, opts: FeedOpts): () => void {
  let phase:"buffering" | "live" = "buffering";
  const buffer: DepthDiff[] = [];
  let lastUpdateId = 0; // u of the most recently applied event

  const socket = new WebSocket(`wss://data-stream.binance.vision/ws/${opts.symbol}@depth`)


  socket.addEventListener('message', (event) => {
    const diff = JSON.parse(event.data) as DepthDiff;
    if(phase === "buffering") {
      // Not synced - hold event for replay
      buffer.push(diff);
    } else {
      // live - apply straight to the book and advance lastUpdateId
      book.applyDiff(diff.b, diff.a);
      lastUpdateId = diff.u;
    }
  });


  fetchSnapshot(opts.symbol).then((snap) => {
    while (buffer.length > 0 && buffer[0].u <= snap.lastUpdateId) {
      buffer.shift();
    }
    if (buffer.length > 0 && !(buffer[0].U <= snap.lastUpdateId + 1 && snap.lastUpdateId + 1 <= buffer[0].u)) {
      console.error('snapshot out of range — stale');
      return;
    }
    book.reset(snap.bids, snap.asks);
    while(buffer.length > 0){
      const depth = buffer.shift()!;
      book.applyDiff(depth.b, depth.a);
      lastUpdateId = depth.u;
    }
    phase = "live";
  });

  socket.addEventListener('error', (event) => {
    console.error("feed socket error", event);
  });
  return () => socket.close();

}


async function fetchSnapshot(symbol: string): Promise<DepthSnapshot> {
  const url = `https://data-api.binance.vision/api/v3/depth?symbol=${symbol.toUpperCase()}&limit=1000`

  const response = await fetch(url);
  if (!response.ok) throw new Error(`snapshot ${response.status}: ${await response.text()}`);
  const data = await response.json() as DepthSnapshot;
  return data;
}
