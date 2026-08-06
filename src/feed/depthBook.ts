import type { BookView, Side } from '../engine/types';
import type { PriceLevel } from './types';


export class DepthBook implements BookView {
  private bids = new Map<number, number>();  
  private asks = new Map<number, number>();

  reset(bids: PriceLevel[], asks: PriceLevel[]): void {
    this.bids = new Map<number, number>();
    this.applyLevels(this.bids, bids);
    this.asks = new Map<number, number>();
    this.applyLevels(this.asks, asks);
  }

  applyDiff(bids: PriceLevel[], asks: PriceLevel[]): void {
    this.applyLevels(this.bids, bids);
    this.applyLevels(this.asks, asks);
  }

  private applyLevels(book: Map<number, number>, levels: PriceLevel[]): void {
    for(const [price, qty] of levels){
      if(Number(qty) === 0){
        book.delete(Number(price));
      } else {
        book.set(Number(price), Number(qty));
      }
    }
  }

  bestBid(): number | undefined {
    if(this.bids.size === 0) return undefined;
    return Math.max(...this.bids.keys());
  }

  bestAsk(): number | undefined {
    if(this.asks.size === 0) return undefined;
    return Math.min(...this.asks.keys());
  }

  levels(side: Side): { price: number; size: number }[] {
    const book = side === "ask" ? this.asks : this.bids;
    const levels: { price: number; size: number }[] = [];
    for(const [price, size] of book) {
      levels.push({price, size})
    }
    
    if(side === "ask") levels.sort((a, b) => a.price - b.price);
    else levels.sort((a, b) => b.price - a.price);
    return levels;
  }
}
