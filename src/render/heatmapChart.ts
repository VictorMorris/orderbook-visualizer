import { Container, Graphics, Text } from 'pixi.js';
import type { Column, PriceWindow } from './heatmap';
import { COLOR, HEAT_STOPS, TEXT, mix } from './theme';
import { fmtPrice } from './format';

const AXIS_W = 56;   // right gutter for price labels
const TICKS = 7;

// Time runs left to right, price top to bottom, colour intensity by resting size
// Update() is driven by the sampler (~4 Hz), not the ticker
export class HeatmapView {
  readonly container = new Container();
  private cells = new Graphics();  // whole map, cleared and rebuilt every update
  private labels: Text[] = [];
  private midLabel = new Text({ text: '', style: TEXT.price });
  private cellW: number;
  private cellH: number;
  private plotW: number;
  private h:number;

  constructor(w: number, h: number, maxColumns: number, rows: number) {
    this.h = h;
    this.plotW = w - AXIS_W;
    this.cellW = this.plotW / maxColumns;
    this.cellH = h / rows;
    this.container.addChild(this.cells);

    // Price ticks down the right gutter, evenly spaced top to bottom.
    for (let i = 0; i < TICKS; i++) {
      const t = new Text({ text: '', style: TEXT.label });
      t.anchor.set(0, 0.5);
      t.x = this.plotW + 8;
      t.y = (i / (TICKS - 1)) * h;
      this.container.addChild(t);
      this.labels.push(t);
    }

    this.midLabel.anchor.set(0, 0.5);
    this.midLabel.x = this.plotW + 8;
    this.container.addChild(this.midLabel);
  }

  // `maxSize` is the colour ceiling
  update(columns: Column[], window: PriceWindow, maxSize: number, mid?: number): void {
    this.cells.clear();
    // Paint the coldest stop everywhere first,  empty cells and zero cells look the same
    this.cells.rect(0, 0, this.plotW, this.h).fill(HEAT_STOPS[0]);

    // Row 0 is the highest price, labels descend down the gutter.
    for (let i = 0; i < TICKS; i++) {
      const row = (i / (TICKS - 1)) * window.rows;
      this.labels[i].text = fmtPrice(window.top - row * window.bucket, 0);
    }

    if (maxSize === 0) return;   // nothing sampled yet: leave the map cold

    // Anchor newest column at the right edge so the map grows leftward.
    const x0 = this.plotW - columns.length * this.cellW;

    for (let c = 0; c < columns.length; c++) {
      const column = columns[c];
      for (let r = 0; r < column.length; r++) {
        if (column[r] === 0) continue;
        // +0.5 on both dimensions overlaps neighbours slightly
        // without it fractional cell sizes leave hairline seams between cells.
        this.cells
          .rect(x0 + c * this.cellW, r * this.cellH, this.cellW + 0.5, this.cellH + 0.5)
          .fill(heatColor(column[r], maxSize));
      }
    }

    // Rule separating the map from the price gutter.
    this.cells.moveTo(this.plotW, 0).lineTo(this.plotW, this.h)
      .stroke({ width: 1, color: COLOR.border });


    if (mid !== undefined) {
      // Same price-to-row maths as HeatmapBuffer.rowOf
      // Kept fractional so the line sits between rows rather than snapping to one.
      const y = ((window.top - mid) / window.bucket) * this.cellH;
      if (y >= 0 && y <= this.h) {
        this.cells.moveTo(0, y).lineTo(this.plotW, y)
          .stroke({ width: 1, color: COLOR.text, alpha: 0.55 });
        this.midLabel.text = fmtPrice(mid, 0);
        this.midLabel.y = y;
        this.midLabel.visible = true;
        return;
      }
    }
    this.midLabel.visible = false;
  }
}


const GAMMA = 1.35;

// Cell color by size
export function heatColor(size: number, maxSize: number): number {
  const ratio = Math.min(size / maxSize, 1);   // sizes above the ceiling all read as max
  const intensity = Math.pow(ratio, GAMMA);
  // Position along the ramp in stop-units: integer part picks the pair,
  // fraction is the blend between them.
  const span = intensity * (HEAT_STOPS.length - 1);
  const i = Math.min(Math.floor(span), HEAT_STOPS.length - 2);   // clamp so i+1 stays in range
  return mix(HEAT_STOPS[i], HEAT_STOPS[i + 1], span - i);
}
