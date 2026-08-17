import type { AggTrade } from './types';

// A trade as the renderer wants it
export interface TapeTrade {
  id: number;
  price: number;
  size: number;
  time: number;
  aggressor: 'buy' | 'sell';
}

// Fixed-capacity array of the most recent trades
// Newest first, so the renderer can slice off the top N without reversing
export class TradeTape {
  private capacity: number;
  private tape:Array<TapeTrade> = []
  constructor(capacity = 100) {
    this.capacity = capacity;
  }

  // Convert the wire event and push it on the front
  // If this pushes size past capacity it deletes oldest entries
  push(trade: AggTrade): void {
      this.tape.unshift({
      id: trade.a,
      price: Number(trade.p),
      size: Number(trade.q),
      time: trade.T,
      aggressor: trade.m === true ? 'sell' : 'buy' // m means buyer was the maker
    });
    while(this.tape.length > this.capacity) this.tape.pop();
  }

  // returns newest n entries
  recent(n: number): TapeTrade[] {
      return this.tape.slice(0,n);
  }

  // Largest size currently held for the renderer to scale bars against it
  // O(n) as it must scan every trade in the tape
  maxSize(): number {
    let max = 0;
    for(const trade of this.tape){
      max = Math.max(max, trade.size);
    }
    return max;
  }
}


// The trade feed doesnt need a snapshot, buffer, or sequence check
export function startTradeFeed(tape: TradeTape, symbol: string): () => void {
  const socket = new WebSocket(`wss://data-stream.binance.vision/ws/${symbol}@aggTrade`);
  
  socket.addEventListener('message', (event) => {
    const trade = JSON.parse(event.data) as AggTrade;
    tape.push(trade);
  });

  socket.addEventListener('error', (event) => console.error('trade socket error', event));


  return () => {
    socket.close();
  }
}
