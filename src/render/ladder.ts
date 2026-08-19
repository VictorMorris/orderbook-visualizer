import { Container, Graphics, Text } from 'pixi.js';
import { COLOR, TEXT } from './theme';
import { fmtPrice, fmtSize } from './format';
import { Eased, Flash, Smooth } from './motion';
import type { TapeTrade } from '../feed/tape';

export type Level = { price: number; size: number };

// Asks stacked above bids around the spead
// Text objects are only created once
// Bars is cleared and redrawn each fram

// Binance quotes BTC at 1-cent ticks, so the top of book is dust spread over
// hundreds of levels. Fold them into `bucket`-wide bins
// bids round down, asks round up, so neither side ever bins across the spread 
export function aggregate(levels: Level[], side: 'bid' | 'ask', bucket: number): Level[] {
  const bins = new Map<number, number>();
  for (const { price, size } of levels) {
    const key = (side === 'bid' ? Math.floor(price / bucket) : Math.ceil(price / bucket)) * bucket;
    bins.set(key, (bins.get(key) ?? 0) + size);
  }
  return [...bins.entries()]
    .map(([price, size]) => ({ price, size }))
    .sort((a, b) => (side === 'bid' ? b.price - a.price : a.price - b.price));
}

// Measured from containers origin
const ROW_H = 16;
const SPREAD_H = 26;
const SIZE_X = 46;    // right edge of the size column
const BAR_X = 54;     // left rail the bars grow from
const PRICE_W = 84;   // right-aligned price column

// The two labels for a single row
interface Row {
  size: Text;
  price: Text;
}

export class LadderView {
  readonly container = new Container();
  private w: number;
  private h: number;
  private depth: number;
  private bucket: number;
  private bars = new Graphics();       // every rect and rule, rebuilt each frame
  private rows: Row[] = [];
  private spreadText = new Text({ text: '', style: TEXT.readout });
  private spreadNote = new Text({ text: '', style: TEXT.label });
  private eased = new Eased();         // bar widths, keyed by price

  private scale = new Smooth();        // shared bar-width divisor, both sides
  private flash = new Flash();         // recent-trade highlight, keyed by price
  private lastTradeId = -1;            // high-water mark; trades arrive repeatedly
  private barW: number;

  private priceDp: number;

  constructor(
    w: number,
    h: number,
    depth = 12,
    bucket = 1,
  ) {
    this.w = w;
    this.h = h;
    this.depth = depth;
    this.bucket = bucket;
    this.barW = w - BAR_X - PRICE_W;   // horizontal room a full-scale bar gets
    // Whole-dollar buckets need no decimals, sub-dollar ones do.
    this.priceDp = bucket >= 1 ? 0 : 2;
    this.container.addChild(this.bars);

    // Rows 0..depth-1 are asks (top half), depth..2*depth-1 are bids
    for (let i = 0; i < depth * 2; i++) {
      const size = new Text({ text: '', style: TEXT.label });
      size.anchor.set(1, 0);
      size.x = SIZE_X;
      const price = new Text({ text: '', style: TEXT.price });
      price.anchor.set(1, 0);
      price.x = w;
      this.container.addChild(size, price);
      this.rows.push({ size, price });
    }

    this.spreadText.anchor.set(0, 0.5);
    this.spreadNote.anchor.set(1, 0.5);
    this.spreadNote.x = w;
    this.container.addChild(this.spreadText, this.spreadNote);
  }

  // y of the top of visual row i, counting asks down from the top
  // Rows at or past `depth` are pushed down by SPREAD_H to leave the gap the spread readout sits in.
  private rowY(i: number): number {
    const top = (this.h - (this.depth * 2 * ROW_H + SPREAD_H)) / 2;
    return i < this.depth
      ? top + i * ROW_H
      : top + i * ROW_H + SPREAD_H;
  }

  // Update the ladder
  update(
    bids: Level[],
    asks: Level[],
    trades: TapeTrade[],
    best: { bid?: number; ask?: number },
    dt: number,
    now: number,
  ): void {
    // A trade price falls in the bid bin below it and the ask bin above it
    // flag both rather than guess which side is on screen.
    for (const t of trades) {
      if (t.id <= this.lastTradeId) continue;
      this.flash.hit(Math.floor(t.price / this.bucket) * this.bucket, now);
      this.flash.hit(Math.ceil(t.price / this.bucket) * this.bucket, now);
    }
    if (trades.length) this.lastTradeId = Math.max(this.lastTradeId, trades[0].id);

    // Bars are scaled against the largest level currently on screen
    // Smoothed so one big level appearing doesn't make every other bar jump
    // Shared across both sides so bid and ask widths stay comparable
    const shown = { asks: asks.slice(0, this.depth), bids: bids.slice(0, this.depth) };
    let peak = 0;
    for (const l of [...shown.asks, ...shown.bids]) peak = Math.max(peak, l.size);
    const scale = this.scale.to(peak || 1, dt) || 1;

    this.bars.clear();
    const live = new Set<number>();  // prices drawn this frame, for eased.keep()

    // Asks fill upward from the spread: visual row (depth-1) is the best ask.
    for (let i = 0; i < this.depth; i++) {
      const level = shown.asks[i];
      const row = this.rows[this.depth - 1 - i];
      const y = this.rowY(this.depth - 1 - i);
      this.paint(row, level, y, scale, COLOR.ask, COLOR.askBar, dt, now, live);
    }

    // Bids fill downward: visual row `depth` is the best bid.
    for (let i = 0; i < this.depth; i++) {
      const level = shown.bids[i];
      const row = this.rows[this.depth + i];
      const y = this.rowY(this.depth + i);
      this.paint(row, level, y, scale, COLOR.bid, COLOR.bidBar, dt, now, live);
    }

    this.eased.keep(live);   // evict animation state for prices that left the view
    this.drawSpread(best.bid, best.ask);
  }

  // Draws one row of the ladder
  private paint(
    row: Row,
    level: Level | undefined,
    y: number,
    scale: number,
    fg: number,
    bar: number,
    dt: number,
    now: number,
    live: Set<number>,
  ): void {
    row.size.y = y + 3;
    row.price.y = y + 2;

    // Fewer levels than rows: blank the row but keep it positioned.
    if (!level) {
      row.size.text = '';
      row.price.text = '';
      return;
    }

    live.add(level.price);
    const width = this.eased.to(level.price, (level.size / scale) * this.barW, dt);

    // Depth bar, then a 2px bright rail at its base so empty levels stay visible.
    this.bars.rect(BAR_X, y + 1, Math.max(width, 1), ROW_H - 2).fill({ color: bar });
    this.bars.rect(BAR_X, y + 1, 2, ROW_H - 2).fill({ color: fg });

    // Full-width wash over the row, fading out over the Flash decay window.
    const hit = this.flash.alpha(level.price, now);
    if (hit > 0) {
      this.bars
        .rect(0, y, this.w, ROW_H)
        .fill({ color: COLOR.flash, alpha: hit * 0.14 });
    }

    row.size.text = fmtSize(level.size, 3);
    row.price.text = fmtPrice(level.price, this.priceDp);
    row.price.style.fill = fg;
  }

  // Mid price and spread in the gap between the two halves
  // Draws into `bars`, so it must run after the rows
  // the clear() at the top of update() owns it.
  private drawSpread(bid: number | undefined, ask: number | undefined): void {
    const y = this.rowY(this.depth) - SPREAD_H / 2;  // centre of the gap

    this.bars.moveTo(0, y - SPREAD_H / 2).lineTo(this.w, y - SPREAD_H / 2)
      .stroke({ width: 1, color: COLOR.border });
    this.bars.moveTo(0, y + SPREAD_H / 2).lineTo(this.w, y + SPREAD_H / 2)
      .stroke({ width: 1, color: COLOR.border });

    this.spreadText.y = y;
    this.spreadNote.y = y;

    if (bid === undefined || ask === undefined) {
      this.spreadText.text = '—';
      this.spreadNote.text = '';
      return;
    }
    // Absolute spread plus its size in basis points, which is comparable across
    // instruments in a way a raw dollar figure isn't.
    const mid = (bid + ask) / 2;
    this.spreadText.text = fmtPrice(mid);
    this.spreadNote.text = `${(ask - bid).toFixed(2)}  ${((ask - bid) / mid * 10000).toFixed(1)}bp`;
  }
}
