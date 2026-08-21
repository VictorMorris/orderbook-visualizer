import { Container } from 'pixi.js';
import { app, scene } from './render/app';
import { startLiveSession, startSyntheticSession, type Session, type SourceKind } from './driver/session';
import { HeatmapBuffer, startHeatmapSampler } from './render/heatmap';
import { PANEL, contentRect, drawPanelFrame } from './render/panel';
import { HeaderView } from './render/header';
import { LadderView, aggregate } from './render/ladder';
import { TapeView } from './render/tape';
import { DepthView } from './render/depthChart';
import { HeatmapView } from './render/heatmapChart';
import { StatsView } from './render/stats';

const SYMBOL = 'btcusdt';
const TAPE_CAPACITY = 600; // deep enough to count a full minute
const FALLBACK_MID = 100000;  // synthetic start price when there's no live book to seed from
const LEVELS = 12;        // rows per side in the ladder
const LADDER_BUCKET = 1;  // $ per ladder row
const TAPE_ROWS = 40;     // trades shown, and the tape's bar-scale population
const HEAT_ROWS = 60;
const HEAT_COLS = 120;
const HEAT_BUCKET = 5;    // $ per heatmap row, this gives a $300 window

// The data source, swapped by the header toggle
let session: Session = startLiveSession(SYMBOL, TAPE_CAPACITY);

// Sampled columns of resting size over time
// Owned here and not by the session, the history outlives any one book
const heatmapBuffer = new HeatmapBuffer(HEAT_ROWS, HEAT_COLS, HEAT_BUCKET, 0);

// Stops the current source and starts the other
function switchSource(kind: SourceKind): void {
  if (kind === session.kind) return;

  // Seeds the simulation from where the live book left off
  // Keeps the swap from jumping the price scale further than it has to
  const bid = session.book.bestBid();
  const ask = session.book.bestAsk();
  const mid = bid !== undefined && ask !== undefined ? (bid + ask) / 2 : FALLBACK_MID;

  session.stop();   // closes sockets, or clears the flow timer
  session = kind === 'live'
    ? startLiveSession(SYMBOL, TAPE_CAPACITY)
    : startSyntheticSession(Math.round(mid), TAPE_CAPACITY);

  heatmapBuffer.clear();   // old columns belong to the old book
  header.setSource(kind);
}

// Static first
scene.addChild(
  drawPanelFrame('Order Book', PANEL.ladder, `${LEVELS} × 2 · $${LADDER_BUCKET} bins`),
  drawPanelFrame('Liquidity Heatmap', PANEL.heatmap, `${HEAT_COLS} cols · $${HEAT_BUCKET}/row · 4 Hz`),
  drawPanelFrame('Trade Tape', PANEL.tape, 'aggTrade'),
  drawPanelFrame('Cumulative Depth', PANEL.depth),
  drawPanelFrame('Book Stats', PANEL.stats),
);

// Position a view's container at its panel's content origin and add it to the scene
function mount(view: { container: Container }, rect: { x: number; y: number }): void {
  view.container.x = rect.x;
  view.container.y = rect.y;
  scene.addChild(view.container);
}

// Each view is sized from its panel's content rect
const header = new HeaderView(PANEL.header.w, PANEL.header.h, session.kind, switchSource);
mount(header, PANEL.header);

const ladderRect = contentRect(PANEL.ladder);
const ladder = new LadderView(ladderRect.w, ladderRect.h, LEVELS, LADDER_BUCKET);
mount(ladder, ladderRect);

const tapeRect = contentRect(PANEL.tape);
const tape = new TapeView(tapeRect.w, tapeRect.h);
mount(tape, tapeRect);

const depthRect = contentRect(PANEL.depth);
const depth = new DepthView(depthRect.w, depthRect.h);
mount(depth, depthRect);

const statsRect = contentRect(PANEL.stats);
const stats = new StatsView(statsRect.w);
mount(stats, statsRect);

const heatRect = contentRect(PANEL.heatmap);
const heat = new HeatmapView(heatRect.w, heatRect.h, HEAT_COLS, HEAT_ROWS);
mount(heat, heatRect);

// Heatmap redraws per sampled column (4 Hz), not per frame
// The book is read through a closure so a source swap doesn't need a new sampler
const stopHeatmap = startHeatmapSampler(heatmapBuffer, () => session.book, 4, () => {
  const bid = session.book.bestBid();
  const ask = session.book.bestAsk();
  const mid = bid !== undefined && ask !== undefined ? (bid + ask) / 2 : undefined;
  heat.update(heatmapBuffer.columns(), heatmapBuffer.window(), heatmapBuffer.scale(), mid);
});

// Per-frame pull: every view is redrawn from current state each tick
// No view subscribes to the feed, so a missed update is invisible
// the next frame just reads whatever the book holds by then.
app.ticker.add(ticker => {
  const dt = ticker.deltaTime;   // frames since last tick, for the easing in motion.ts
  const now = Date.now();        // wall clock, to age trades against their exchange timestamps
  // Raw levels, best-first. Read once and shared by every view below.
  const bids = session.book.levels('bid');
  const asks = session.book.levels('ask');
  const best = { bid: bids[0]?.price, ask: asks[0]?.price };

  const shown = session.tape.recent(TAPE_ROWS);              // what the tape panel displays
  const minute = session.tape.recent(TAPE_CAPACITY);         // wider slice, for the trades/min stat, this also caps t/m at the capacity
  // Scale tape bars against what's on screen
  const peak = shown.reduce((m, t) => Math.max(m, t.size), 0);

  // Each view gets the slice and shape it needs:
  // the ladder wants bucketed levels
  // the depth chart a fixed count
  // stats the raw book.
  header.update(best.bid, best.ask);
  ladder.update(
    aggregate(bids, 'bid', LADDER_BUCKET),
    aggregate(asks, 'ask', LADDER_BUCKET),
    shown, best, dt, now,
  );
  tape.update(shown, peak, dt, performance.now());
  depth.update(bids.slice(0, 40), asks.slice(0, 40), dt);
  stats.update(bids, asks, minute, dt, now);
});


import.meta.hot?.dispose(() => { session.stop(); stopHeatmap(); });
