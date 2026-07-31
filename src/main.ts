import { app } from './render/app';
import { OrderBook } from './engine/orderbook';
import type { Order } from './engine/types';
import { drawLadder } from './render/ladder';


const book = new OrderBook();
const seed: Order[] = [
    { id: 'a1', side: 'ask', price: 100.5, size: 12 },
    { id: 'a2', side: 'ask', price: 101.0, size: 5 },
    { id: 'a3', side: 'ask', price: 101.0, size: 3 },
    { id: 'a4', side: 'ask', price: 101.5, size: 20 },
    { id: 'a5', side: 'ask', price: 102.0, size: 7 },
    { id: 'a6', side: 'ask', price: 102.5, size: 15 },
    { id: 'b1', side: 'bid', price: 99.5, size: 10 },
    { id: 'b2', side: 'bid', price: 99.0, size: 18 },
    { id: 'b3', side: 'bid', price: 99.0, size: 4 },
    { id: 'b4', side: 'bid', price: 98.5, size: 6 },
    { id: 'b5', side: 'bid', price: 98.0, size: 14 },
    { id: 'b6', side: 'bid', price: 97.5, size: 9 },
];
seed.forEach((o) => book.submit(o));

app.stage.addChild(drawLadder(book.levels('bid'), book.levels('ask')));