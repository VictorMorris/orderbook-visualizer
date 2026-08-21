import { OrderBook } from '../engine/orderbook';
import type { Order, Side, Trade } from '../engine/types';

export interface SyntheticOpts {
  mid: number;         // starting value, and the level the walk is pulled back toward
  hz: number;          // events per second
  tick: number;        // price increment, all prices snap to this grid
  spread: number;      // mean distance from the touch, in ticks, that passive orders rest at
  size: number;        // median order size, in the base asset
  target: number;      // resting order count the add/cancel mix balances toward
  aggression: number;  // share of events that are marketable
  drift: number;       // stddev of the walk, in ticks per event
  warmup: number;      // passive orders placed before the timer starts
  onTrade?: (trades: Trade[], taker: Side) => void;
}

// Box-Muller
// Two uniforms in, one standard normal out
function gauss(): number {
  const u = 1 - Math.random();   // (0,1], keeps the log finite
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Exponential draw, truncated to whole ticks
// Thick near the touch and thin far out, roughly the shape of a real book
function expTicks(mean: number): number {
  return Math.floor(-Math.log(1 - Math.random()) * mean);
}

// Lognormal around median, 2% chance of a whale 10x the size
// The fat tail is what the heatmap's percentile scaling exists for
function sizeOf(median: number): number {
  const base = Math.exp(gauss() * 0.8) * median;
  const whale = Math.random() < 0.02 ? 10 : 1;
  return Number((base * whale).toFixed(5));
}

// Drives an OrderBook with flow that looks like a market
// Fair value wanders, passive quotes post around it, stale quotes get pulled,
// and marketable orders eat through the touch and print trades
export function startSyntheticFlow(book: OrderBook, opts: SyntheticOpts): () => void {
  // Ids we think are still resting, with the price they rest at
  // The price is only kept so cancels can be biased by distance from fair
  const resting: { id: string; price: number }[] = [];
  let fair = opts.mid;
  let n = 0;

  // Snap to the tick grid
  // Levels only aggregate if prices land on it exactly, toFixed clears the float dust
  const snap = (price: number) => Number((Math.round(price / opts.tick) * opts.tick).toFixed(2));

  // Posts a passive order, never crosses
  function add(): void {
    const side: Side = Math.random() < 0.5 ? 'bid' : 'ask';
    const offset = expTicks(opts.spread) * opts.tick;
    // Clamped to just inside the opposite touch
    // A passive order priced through it would match, and matching is cross()'s job
    const price = side === 'bid'
      ? snap(Math.min(fair, (book.bestAsk() ?? Infinity) - opts.tick) - offset)
      : snap(Math.max(fair, (book.bestBid() ?? -Infinity) + opts.tick) + offset);

    const order: Order = { id: `syn${n++}`, side, price, size: sizeOf(opts.size) };
    book.submit(order);
    resting.push({ id: order.id, price });
  }

  // Pulls one resting order
  // Samples three and drops the furthest from fair, quotes go stale from the outside in
  function cancelOne(): void {
    let pick = -1;
    for (let i = 0; i < 3; i++) {
      const j = Math.floor(Math.random() * resting.length);
      if (pick < 0 || Math.abs(resting[j].price - fair) > Math.abs(resting[pick].price - fair)) pick = j;
    }
    const [order] = resting.splice(pick, 1);
    book.cancel(order.id);
  }

  // Sends a marketable order priced through the opposite touch
  // The engine decides how deep it eats
  function cross(): void {
    const side: Side = Math.random() < 0.5 ? 'bid' : 'ask';
    const through = expTicks(opts.spread / 2) * opts.tick;
    const price = side === 'bid'
      ? snap((book.bestAsk() ?? fair) + through)
      : snap((book.bestBid() ?? fair) - through);

    const order: Order = { id: `syn${n++}`, side, price, size: sizeOf(opts.size) };
    const trades = book.submit(order);   // submit decrements order.size as it fills

    // A traded maker is either gone or partly filled and the trade doesn't say which
    // Stop tracking it either way, cancelling a filled id is a wasted scan of both books
    for (const trade of trades) {
      const i = resting.findIndex(o => o.id === trade.makerId);
      if (i >= 0) resting.splice(i, 1);
    }

    if (order.size > 0) resting.push({ id: order.id, price });   // leftover rests at an aggressive price
    if (trades.length > 0) opts.onTrade?.(trades, side);
  }

  // One event, called on the timer and by the warmup loop
  function step(): void {
    // Random walk with a weak pull back to the starting mid
    // Keeps a long session from wandering off the price scale
    fair += (gauss() * opts.drift + (opts.mid - fair) * 0.0005) * opts.tick;

    if (Math.random() < opts.aggression) return cross();

    // Self balancing add/cancel ratio
    // pAdd is 1 on an empty book, 0.5 at the target, and 0 at twice the target
    const pAdd = 1 - resting.length / (2 * opts.target);
    if (Math.random() < pAdd) add();
    else cancelOne();
  }

  // Fills the book before the first frame reads it, so the panels open with depth
  // Passive orders only, the warmup prints nothing
  for (let i = 0; i < opts.warmup; i++) add();

  // Events are paced off elapsed time, not off timer firings
  // Timer resolution varies (Windows coalesces to ~15ms) and background tabs are
  // throttled, so one event per firing makes hz mean whatever the platform allows
  // maxBurst stops a throttled tab dumping its whole backlog into one frame
  const period = 1000 / opts.hz;
  const maxBurst = Math.max(1, Math.ceil(opts.hz / 10));
  let last = Date.now();

  const timer = setInterval(() => {
    const now = Date.now();
    const due = Math.min(Math.floor((now - last) / period), maxBurst);
    if (due === 0) return;      // less than a full period, leave the remainder on the clock
    last += due * period;
    for (let i = 0; i < due; i++) step();
  }, period);

  return () => clearInterval(timer);
}
