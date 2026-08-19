import { Container, Graphics, Text } from 'pixi.js';
import { COLOR, TEXT } from './theme';
import { fmtPrice, fmtSize } from './format';
import { Smooth } from './motion';
import type { Level } from './ladder';
import type { TapeTrade } from '../feed/tape';

const ROW_H = 22;
const NEAR = 50;   // levels counted on each side for imbalance
// Row order is the layout: index into LABELS is the index into `values`.
const LABELS = [
  'BEST BID', 'BEST ASK', 'BID DEPTH', 'ASK DEPTH',
  'BOOK LEVELS', 'TRADES/MIN', 'LAST TRADE',
] as const;

// Readout column: a fixed list of label/value rows, with the imbalance meter
// underneath. Labels are drawn once; update() only rewrites the value texts.
export class StatsView {
  readonly container = new Container();
  private bar = new Graphics();
  private values: Text[] = [];
  private imbalance = new Smooth(0.08);   // slow so the meter drifts
  private w: number;

  private imbalanceLabel = new Text({ text: `IMBALANCE · TOP ${NEAR}`, style: TEXT.label });
  private imbalanceValue = new Text({ text: '', style: TEXT.label });

  constructor(w: number) {
    this.w = w;
    this.container.addChild(this.bar);

    // Imbalance block sits directly below the last stat row.
    this.imbalanceLabel.x = 0;
    this.imbalanceLabel.y = LABELS.length * ROW_H;
    this.imbalanceValue.anchor.set(1, 0);
    this.imbalanceValue.x = w;
    this.imbalanceValue.y = LABELS.length * ROW_H;
    this.container.addChild(this.imbalanceLabel, this.imbalanceValue);

    // Label left, value right-anchored to the panel edge
    LABELS.forEach((label, i) => {
      const key = new Text({ text: label, style: TEXT.label });
      key.x = 0;
      key.y = i * ROW_H + 4;
      const value = new Text({ text: '—', style: TEXT.readout });
      value.anchor.set(1, 0);
      value.x = w;
      value.y = i * ROW_H;
      this.container.addChild(key, value);
      this.values.push(value);
    });
  }

  update(bids: Level[], asks: Level[], trades: TapeTrade[], dt: number, now: number): void {
    const sum = (ls: Level[]) => ls.reduce((a, l) => a + l.size, 0);
    const bidDepth = sum(bids);
    const askDepth = sum(asks);
    // Trades in the last minute
    // Bounded by the tape's capacity, so this reads as "at least N" once the market is busier than the buffer is deep.
    const recent = trades.filter(t => now - t.time < 60_000).length;

    // Indices match LABELS above.
    this.set(0, bids[0] ? fmtPrice(bids[0].price) : '—', COLOR.bid);
    this.set(1, asks[0] ? fmtPrice(asks[0].price) : '—', COLOR.ask);
    this.set(2, fmtSize(bidDepth), COLOR.text);
    this.set(3, fmtSize(askDepth), COLOR.text);
    this.set(4, `${bids.length} / ${asks.length}`, COLOR.text);
    this.set(5, String(recent), COLOR.text);
    this.set(
      6,
      trades[0] ? fmtPrice(trades[0].price) : '—',
      trades[0]?.aggressor === 'sell' ? COLOR.ask : COLOR.bid,
    );

    //Only levels near the touch say anything about pressure.
    const nearBid = sum(bids.slice(0, NEAR));
    const nearAsk = sum(asks.slice(0, NEAR));
    // Bid share of near-touch size: 0.5 is balanced, above means bid pressure.
    const total = nearBid + nearAsk;
    const target = total ? nearBid / total : 0.5;   // empty book reads as neutral
    const ratio = this.imbalance.to(target, dt);

    const y = LABELS.length * ROW_H + 18;
    this.bar.clear();
    // Full-width ask bar, overpainted from the left with the bid share
    this.bar.rect(0, y, this.w, 10).fill(COLOR.askBar);
    this.bar.rect(0, y, this.w * ratio, 10).fill(COLOR.bidBar);
    this.bar.rect(this.w * ratio - 1, y - 3, 2, 16).fill(COLOR.text);
    this.imbalanceValue.text = `${(ratio * 100).toFixed(1)}% BID`;
    this.imbalanceValue.style.fill = ratio >= 0.5 ? COLOR.bid : COLOR.ask;
  }

  // Set row i's value text and colour.
  private set(i: number, text: string, fill: number): void {
    this.values[i].text = text;
    this.values[i].style.fill = fill;
  }
}
