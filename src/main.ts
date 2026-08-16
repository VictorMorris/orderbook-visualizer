import { app } from './render/app';
import { OrderBook } from './engine/orderbook';
import { drawLadder } from './render/ladder';
import { drawDepth } from './render/depthChart';
import { startSynthetic } from './driver/synthetic';
import { Container } from 'pixi.js';
import { startBinanceFeed } from './feed/binance';
import { DepthBook } from './feed/depthBook';
import { startTradeFeed, TradeTape } from './feed/tape';
import { drawTape } from './render/tape';
import { HeatmapBuffer, startHeatmapSampler } from './render/heatmap';
import { drawHeatmap } from './render/heatmapChart';

const orderBook = new OrderBook();
const depthBook = new DepthBook();
const tradeTape = new TradeTape();
const stop = startSynthetic(orderBook, { mid: 100, hz: 30, levels: 6, tick: 0.5 });
const stopFeed = startBinanceFeed(depthBook, {symbol:"btcusdt"});
const stopTape = startTradeFeed(tradeTape, 'btcusdt');

const GUTTER = 40;
const LADDER_W = 240;
const TAPE_W = 320;
const TOP_H = 540;

const ladder = app.stage.addChild(new Container());
const depth  = app.stage.addChild(new Container());
const tape = app.stage.addChild(new Container());
const heatmap = app.stage.addChild(new Container());

ladder.x = GUTTER;
ladder.y = GUTTER;

tape.x = GUTTER + LADDER_W + GUTTER;
tape.y = GUTTER;

heatmap.x = GUTTER + LADDER_W + GUTTER + TAPE_W + GUTTER;
heatmap.y = GUTTER;

depth.x = GUTTER;
depth.y = GUTTER + TOP_H + GUTTER;


const heatmapBuffer = new HeatmapBuffer(60, 120, 5, 0);
const stopHeatmap = startHeatmapSampler(heatmapBuffer, depthBook, 4, () => {
    heatmap.removeChildren().forEach(c => c.destroy({ children: true }));
    heatmap.addChild(drawHeatmap(
        heatmapBuffer.columns(),
        heatmapBuffer.window(),
        heatmapBuffer.maxSize(),
    ));
});

app.ticker.add(() => {
    const N = 15;
    const bids = depthBook.levels("bid").slice(0, N);
    const asks = depthBook.levels("ask").slice(0,N);
    const trades = tradeTape.recent(25);
    
    ladder.removeChildren().forEach(c => c.destroy({ children: true }));
    depth.removeChildren().forEach(c => c.destroy({ children: true }));
    tape.removeChildren().forEach(c => c.destroy({ children: true }));

    ladder.addChild(drawLadder(bids, asks));
    depth.addChild(drawDepth(bids, asks));
    tape.addChild(drawTape(trades, tradeTape.maxSize()));
});

import.meta.hot?.dispose(() => { stop(); stopFeed(); stopTape(); stopHeatmap(); });
