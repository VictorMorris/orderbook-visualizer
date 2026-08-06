import { DepthBook } from './depthBook';
import type { DepthDiff, DepthSnapshot } from './types';

export interface FeedOpts {
  symbol: string;   // lowercase, e.g. "btcusdt"
}

// Endpoints (market-data-only Binance mirror — no auth)
//   WS:   wss://data-stream.binance.vision/ws/<symbol>@depth
//   REST: https://data-api.binance.vision/api/v3/depth?symbol=<SYMBOL>&limit=1000

export function startBinanceFeed(book: DepthBook, opts: FeedOpts): () => void {
  const socket = new WebSocket(`wss://data-stream.binance.vision/ws/${opts.symbol}@depth`)

   socket.addEventListener('open', () => {
    // connected
  });

  socket.addEventListener('message', (event) => {
    const diff = JSON.parse(event.data) as DepthDiff;
    console.log(diff.U, diff.u)
  });

  socket.addEventListener('error', (event) => {
    console.error("feed socket error", event);
  });

  return () => socket.close();

}
