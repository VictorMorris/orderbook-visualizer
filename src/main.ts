import { app } from './render/app';
import { OrderBook } from './engine/orderbook';
import { drawLadder } from './render/ladder';
import { drawDepth } from './render/depthChart';
import { startSynthetic } from './driver/synthetic';
import { Container } from 'pixi.js';
import { startBinanceFeed } from './feed/binance';
import { DepthBook } from './feed/depthBook';

const orderBook = new OrderBook();
const depthBook = new DepthBook();
const stop = startSynthetic(orderBook, { mid: 100, hz: 30, levels: 6, tick: 0.5 });
const stopFeed = startBinanceFeed(depthBook, {symbol:"btcusdt"})

const ladder = app.stage.addChild(new Container());
const depth  = app.stage.addChild(new Container());
depth.y = 220;

app.ticker.add(() => {
    const N = 15;
    const bids = depthBook.levels("bid").slice(0, N);
    const asks = depthBook.levels("ask").slice(0,N);
    
    ladder.removeChildren().forEach(c => c.destroy({ children: true }));
    depth.removeChildren().forEach(c => c.destroy({ children: true }));

    ladder.addChild(drawLadder(bids, asks));
    depth.addChild(drawDepth(bids, asks));
});

import.meta.hot?.dispose(() => { stop(); stopFeed(); });
