import type { BookView, Order, Side, Trade } from './types';

export class OrderBook implements BookView {
    // price : FIFO queue of resting orders
    private bids = new Map<number, Order[]>(); 
    private asks = new Map<number, Order[]>();

    // Returns highest bid
    // O(n) scan of every price key
    bestBid(): number | undefined {
        let highest: number | undefined = undefined;
        for(const price of this.bids.keys()) {
            if(highest === undefined || price > highest) {
                highest = price;
            }
        }
        return highest;
    }

    // Returns lowest ask
    // O(n) scan of every price key
    bestAsk(): number | undefined { 
        let lowest: number | undefined = undefined;
        for(const ask of this.asks) {
            if(lowest === undefined || ask[0] < lowest) {
                lowest = ask[0];
            }
        }
        return lowest;
    }

    // appends order to the correct side's price-level queue (creating the level if needed)
    private rest(order: Order): void {
        const book = order.side === "ask" ? this.asks : this.bids;
        const queue = book.get(order.price)
        if(queue) queue.push(order);
        else book.set(order.price, [order]);
    }

    // Fulfill the order for as much as is available
    // Trades exectute at makers price and the remainder rests
    // Mutates the Order, decremented size as it is filled
    submit(order: Order): Trade[] {
        const trades: Trade[] = [];
        const book = order.side === "bid" ? this.asks : this.bids;
        
        // Bid crosses when its price is at or above ask
        const crosses = (makerPrice: number) =>
            order.side === "bid" ? order.price >= makerPrice : order.price <= makerPrice;

        while (order.size > 0) {
            const bestPrice = order.side === "bid" ? this.bestAsk() : this.bestBid();
            if (bestPrice === undefined || !crosses(bestPrice)) break;

            const queue = book.get(bestPrice)!;
            const maker = queue[0];

            const fill = Math.min(order.size, maker.size);
            trades.push({ price: maker.price, size: fill, makerId: maker.id, takerId: order.id });
            order.size -= fill;
            maker.size -= fill;

            if (maker.size === 0) {
                queue.shift();
                if (queue.length === 0) book.delete(bestPrice);
            }
        }

        if (order.size > 0) this.rest(order);
        return trades;
    }
    // find the order by id in its level's queue and remove it
    // O(n) scan of both books
    cancel(id: string): void {
        for (const book of [this.bids, this.asks]) {
            for(const [price, queue] of book) {
                for(let i=0; i<queue.length; i++) {
                    if(queue[i].id === id) {
                        queue.splice(i, 1);
                        if(queue.length === 0) book.delete(price);
                        return;
                    }
                }
            }
        }
    }
    // Sorted levels with total size
    // Asks are sorted in descending order
    // Bids are sorted in ascending order
    levels(side: Side): { price: number; size: number }[] {
        const book = side === "ask" ? this.asks : this.bids;
        const levels: { price: number; size: number }[] = [];
        for(const [price, queue] of book) {
            let size = 0
            for(const order of queue) {
                size += order.size;
            }
            levels.push({price, size})
        }
        
        if(side === "ask") levels.sort((a, b) => a.price - b.price);
        else levels.sort((a, b) => b.price - a.price);
        return levels;
    }
}