import { Container, Graphics, Text } from 'pixi.js';
import { cumulative, type Level, type DepthPoint } from './depth';
import { COLOR, TEXT } from './theme';
import { fmtPrice, fmtSize } from './format';
import { Smooth } from './motion';

const AXIS_W = 44;   // left gutter for cumulative-size labels
const AXIS_H = 16;   // bottom band for price labels
const Y_TICKS = 4;

// Cumulative depth, bids mirrored left of centre and asks right
// The x axis is level index, not price: each level gets equal width
export class DepthView {
  readonly container = new Container();
  private grid = new Graphics();   // axes and gridlines, redrawn each frame
  private curve = new Graphics();  // both staircases, redrawn each frame
  private yLabels: Text[] = [];
  private xLabels: Text[] = [];
  private scale = new Smooth();    // smoothed y-axis maximum, shared by both sides
  private plotW: number;
  private plotH: number;

  constructor(w: number, h: number) {
    // Plot area is the panel minus the two axis gutters
    this.plotW = w - AXIS_W;
    this.plotH = h - AXIS_H;
    this.container.addChild(this.grid, this.curve);

    // y labels sit at fixed heights, only their text changes as the scale moves.
    for (let i = 0; i <= Y_TICKS; i++) {
      const t = new Text({ text: '', style: TEXT.label });
      t.anchor.set(1, 0.5);
      t.x = AXIS_W - 8;
      t.y = this.plotH - (i / Y_TICKS) * this.plotH;
      this.container.addChild(t);
      this.yLabels.push(t);
    }

    // Three x labels: deepest bid, mid, deepest ask
    // Anchored left / centre / right so the outer two don't overhang the plot edges
    for (let i = 0; i < 3; i++) {
      const t = new Text({ text: '', style: TEXT.label });
      t.anchor.set(i === 0 ? 0 : i === 1 ? 0.5 : 1, 0);
      t.x = AXIS_W + (i / 2) * this.plotW;
      t.y = this.plotH + 4;
      this.container.addChild(t);
      this.xLabels.push(t);
    }
  }

  update(bids: Level[], asks: Level[], dt: number): void {
    const bidPts = cumulative(bids);
    const askPts = cumulative(asks);
    this.curve.clear();
    this.grid.clear();

    // Cumulative totals only rise, so the deepest point of each side is its total
    // Scaling both sides off the larger keeps them visually comparable
    const last = (pts: DepthPoint[]) => (pts.length ? pts[pts.length - 1].cum : 0);
    const peak = Math.max(last(bidPts), last(askPts));
    const yScale = this.scale.to(peak || 1, dt) || 1;

    for (let i = 0; i <= Y_TICKS; i++) {
      const y = this.plotH - (i / Y_TICKS) * this.plotH;
      this.grid.moveTo(AXIS_W, y).lineTo(AXIS_W + this.plotW, y)
        .stroke({ width: 1, color: COLOR.grid });
      this.yLabels[i].text = fmtSize((i / Y_TICKS) * yScale, 1);
    }

    const n = Math.max(bidPts.length, askPts.length, 1);
    const spacing = this.plotW / 2 / n;
    const centerX = AXIS_W + this.plotW / 2;
    // Screen y grows downward, so a bigger cum means a smaller y
    const yAt = (cum: number) => this.plotH - (cum / yScale) * this.plotH;

    // Centre line: the spread, where both curves start.
    this.grid.moveTo(centerX, 0).lineTo(centerX, this.plotH)
      .stroke({ width: 1, color: COLOR.dim });

    // Draws one side's staircase
    // `xAt` maps a step index to screen x
    const side = (pts: DepthPoint[], xAt: (d: number) => number, color: number) => {
      if (!pts.length) return;
      // Each level is two segments: across at the previous total, then up to the new one
      this.curve.moveTo(xAt(0), this.plotH);
      this.curve.lineTo(xAt(0), yAt(pts[0].cum));
      for (let k = 1; k < pts.length; k++) {
        this.curve.lineTo(xAt(k), yAt(pts[k - 1].cum));
        this.curve.lineTo(xAt(k), yAt(pts[k].cum));
      }
      this.curve.lineTo(xAt(pts.length), yAt(last(pts)));
      this.curve.lineTo(xAt(pts.length), this.plotH);
      this.curve.fill({ color, alpha: 0.14 });

      this.curve.moveTo(xAt(0), yAt(pts[0].cum));
      for (let k = 1; k < pts.length; k++) {
        this.curve.lineTo(xAt(k), yAt(pts[k - 1].cum));
        this.curve.lineTo(xAt(k), yAt(pts[k].cum));
      }
      this.curve.lineTo(xAt(pts.length), yAt(last(pts)));
      this.curve.stroke({ width: 1.5, color });
    };

    side(bidPts, d => centerX - d * spacing, COLOR.bid);
    side(askPts, d => centerX + d * spacing, COLOR.ask);

    // Axis labels
    const lo = bids.length ? bids[bids.length - 1].price : undefined;
    const hi = asks.length ? asks[asks.length - 1].price : undefined;
    const mid = bids.length && asks.length ? (bids[0].price + asks[0].price) / 2 : undefined;
    this.xLabels[0].text = lo === undefined ? '' : fmtPrice(lo);
    this.xLabels[1].text = mid === undefined ? '' : fmtPrice(mid);
    this.xLabels[2].text = hi === undefined ? '' : fmtPrice(hi);
  }
}
