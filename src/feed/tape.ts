import type { AggTrade } from './types';

// A trade as the renderer wants it
export interface TapeTrade {
  id: number;
  price: number;
  size: number;
  time: number;
  aggressor: 'buy' | 'sell';
}

// Fixed-capacity ring of the most recent trades. Newest first, so the renderer
// can slice off the top N without reversing.
export class TradeTape {
  private capacity: number;
  private tape:Array<TapeTrade> = []
  constructor(capacity = 100) {
    this.capacity = capacity;
  }

  // Convert the wire event and push it on the front, evicting past capacity.
  push(trade: AggTrade): void {
      this.tape.unshift({
      id: trade.a,
      price: Number(trade.p),
      size: Number(trade.q),
      time: trade.T,
      aggressor: trade.m === true ? 'sell' : 'buy'
    });
    while(this.tape.length > this.capacity) this.tape.pop();
  }

  // Newest-first view, at most n entries.
  recent(n: number): TapeTrade[] {
      return this.tape.slice(0,n);
  }

  // Largest size currently held — the renderer scales bars against it.
  maxSize(): number {
    let max = 0;
    for(const trade of this.tape){
      max = Math.max(max, trade.size);
    }
    return max;
  }
}


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
