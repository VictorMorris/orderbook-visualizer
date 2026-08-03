import { OrderBook } from '../engine/orderbook';
import type { Order, Side } from '../engine/types';

interface SyntheticOpts {
  mid: number;
  hz: number;
  levels: number;
  tick: number;
}

export function startSynthetic(book: OrderBook, opts: SyntheticOpts): () => void{
    const ids:Array<string> = [];
    let n = 0;

    const synInt = setInterval(() => {
        const pAdd = Math.max(0, Math.min(1 - ids.length / (2 * opts.levels*6),1));
        const action:string = Math.random() < pAdd ? "Add" : "Cancel";
        const side:Side = (Math.random() < 0.5) ?  "ask": "bid";
        const price = side === "ask" ? opts.mid + Math.floor(Math.random() * (opts.levels)+1) * opts.tick : opts.mid - Math.floor(Math.random() * (opts.levels)+1) * opts.tick;
        if(action === "Add") {
            const order:Order = {
                id:`syn${n++}`,
                side:side,
                price:price,
                size:Math.ceil(Math.random()*20)
            };
            book.submit(order);
            ids.push(order.id);
        } else {
            const randId = ids.splice(Math.floor(Math.random()*ids.length),1)[0];
            book.cancel(randId);
        }
    }, 1000/opts.hz)
    return () => {
        clearInterval(synInt);
    };
}