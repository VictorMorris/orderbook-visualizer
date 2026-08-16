import { Container, Graphics} from 'pixi.js';
import type { Column, PriceWindow } from './heatmap';

// Time runs left to right, price top to bottom, colour intensity by resting
// size. Call this when a new column lands (~4 Hz), NOT every ticker frame —
// columns * rows is ~7200 cells and rebuilding that at 60 Hz will stutter.
export function drawHeatmap(
  columns: Column[],
  window: PriceWindow,
  maxSize: number,
): Container {
  const heatMap = new Container();
  if(maxSize === 0) return heatMap;
  const g = new Graphics();
  for(let c=0; c<columns.length; c++) {
    for(let b=0; b<columns[c].length; b++){
      if(columns[c][b] === 0) continue;
      const color = heatColor(columns[c][b], maxSize);
      g.rect(c*10, b*10, 10, 10).fill(color);
    }
  }
  heatMap.addChild(g);
  return heatMap;
}

// Map a bucket size to a colour. Linear intensity washes out — most buckets sit
// near zero while a wall is orders of magnitude larger — so compress first.
export function heatColor(size: number, maxSize: number): number {
  const ratio = size / maxSize;
  const redValue = Math.floor(Math.log1p(ratio * 50) / Math.log1p(50) * 255);

  return (redValue << 16) | (0 << 8) | 0;
}
