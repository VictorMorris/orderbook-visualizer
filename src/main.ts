import { app } from './render/app';
import { OrderBook } from './engine/orderbook';
import { drawLadder } from './render/ladder';
import { drawDepth } from './render/depthChart';
import { startSynthetic } from './driver/synthetic';
import { Container } from 'pixi.js';

const book = new OrderBook();
const stop = startSynthetic(book, { mid: 100, hz: 30, levels: 6, tick: 0.5 });

const ladder = app.stage.addChild(new Container());
const depth  = app.stage.addChild(new Container());
depth.y = 220;

app.ticker.add(() => {
    const bids = book.levels("bid");
    const asks = book.levels("ask");
    
    ladder.removeChildren();
    depth.removeChildren();

    ladder.addChild(drawLadder(bids, asks));
    depth.addChild(drawDepth(bids, asks));
});

import.meta.hot?.dispose(() => stop());
