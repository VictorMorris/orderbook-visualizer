import { Order, Side, Trade } from './types';

export class OrderBook {
  private bids = new Map<number, Order[]>(); // price -> FIFO queue of resting orders
  private asks = new Map<number, Order[]>();

  bestBid(): number | undefined { /* highest bid price, or undefined if empty */ }
  bestAsk(): number | undefined { /* lowest ask price, or undefined if empty */ }

  private rest(order: Order): void {
    // append to the correct side's price-level queue (creating the level if needed)
  }

  submit(order: Order): Trade[] {
    // match against the OPPOSITE side, best price inward, while prices cross;
    // emit a Trade per fill; rest any leftover size. Return the trades.
  }

  cancel(id: string): void {
    // find the order by id in its level's queue and remove it
  }

  levels(side: Side): { price: number; size: number }[] {
    // sorted levels with total size — you'll feed this to the renderer later
  }
}