import { OrderBook } from '../engine/orderbook';
import type { BookView } from '../engine/types';
import { startBinanceFeed } from '../feed/binance';
import { DepthBook } from '../feed/depthBook';
import { startTradeFeed, TradeTape } from '../feed/tape';
import { startSyntheticFlow } from './synthetic';

export type SourceKind = 'live' | 'synthetic';

// Everything the renderer needs from a data source, and nothing about which one it is
// DepthBook off the feed and OrderBook off the engine both fit
export interface Session {
  readonly kind: SourceKind;
  readonly book: BookView;
  readonly tape: TradeTape;
  stop(): void;
}

// Binance depth diffs into a DepthBook, aggTrade prints into the tape
export function startLiveSession(symbol: string, tapeCapacity: number): Session {
  const book = new DepthBook();
  const tape = new TradeTape(tapeCapacity);
  const stopFeed = startBinanceFeed(book, { symbol });
  const stopTape = startTradeFeed(tape, symbol);

  return {
    kind: 'live',
    book,
    tape,
    stop: () => { stopFeed(); stopTape(); },
  };
}

// Synthetic flow into the real matching engine
// The tape holds trades our own submit() produced, not an exchange's
export function startSyntheticSession(mid: number, tapeCapacity: number): Session {
  const book = new OrderBook();
  const tape = new TradeTape(tapeCapacity);
  let id = 0;   // stands in for Binance's aggregate trade id

  const stop = startSyntheticFlow(book, {
    mid,
    hz: 80,
    tick: 1,
    spread: 40,        // most quotes land within $150 of the touch, fills the heatmap window
    size: 0.2,         // BTC, close to what a real level on this book holds
    target: 700,
    aggression: 0.02,  // a cross eats two or three makers, so about 3 prints/second
    drift: 0.25,       // ~$2/s of price movement
    warmup: 900,
    onTrade: (trades, taker) => {
      const time = Date.now();   // the views age trades against wall clock
      // Aggressor is the taker's side, a crossing bid lifted the offer
      const aggressor = taker === 'bid' ? 'buy' : 'sell';
      for (const trade of trades) {
        tape.pushTape({ id: id++, price: trade.price, size: trade.size, time, aggressor });
      }
    },
  });

  return { kind: 'synthetic', book, tape, stop };
}
