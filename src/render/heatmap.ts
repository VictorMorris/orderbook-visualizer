import type { BookView } from '../engine/types';

// Each column is one time sample
// Index is price row, Value is total resting size
export type Column = Float32Array;


export interface PriceWindow {
  top: number;     // price of row 0
  bucket: number;  // price per row
  rows: number;
}

// Positive delta shifts rows downs
// Vacated rows are filled with 0
function shiftRows(column: Column, delta: number): void {
  if (delta > 0) {
    column.copyWithin(delta, 0);
    column.fill(0, 0, Math.min(delta, column.length));
  } else {
    column.copyWithin(0, -delta);
    column.fill(0, Math.max(0, column.length + delta));
  }
}

export class HeatmapBuffer {
  private static readonly MARGIN = 0.25;

  private readonly rows: number;
  private readonly maxColumns: number;
  private readonly bucket: number;
  private top: number;
  private history: Column[] = [];

  constructor(
    rows = 60,
    maxColumns = 120, // 30 seconds of history at 4hz
    bucket = 1,
    top = 100, // Placeholder, gets recentered on startup
  ) {
    this.rows = rows;
    this.maxColumns = maxColumns;
    this.bucket = bucket;
    this.top = top;
  }


  sample(book: BookView): void {
    const ask = book.bestAsk();
    const bid = book.bestBid();
    if (ask === undefined || bid === undefined) return;
    
    this.reanchor((ask + bid)/2) // Reanchor chart to price mid point
    const column:Column = new Float32Array(this.rows)

    // get every size at price
    for(const {price, size} of book.levels('ask')) {
      const row = this.rowOf(price);
      if(row>=0) column[row] += size;
    }
    for(const {price, size} of book.levels('bid')) {
      const row = this.rowOf(price);
      if(row>=0) column[row] += size;
    }

    // Add column to history and pop oldest one
    this.history.push(column);
    if(this.history.length > this.maxColumns) this.history.shift();
  }


  // Returns the row of a price, grouping by bucket
  private rowOf(price: number): number {
    if(this.top >= price && price > this.top-(this.bucket*this.rows)){
      return Math.floor((this.top-price)/this.bucket);
    } else return -1;
  }



  // Reanchors the chart to the price midpoint
  // Shifting all historical prices keeps the old samples aligned to the new row-price mapping
  private reanchor(mid: number): void {
    const span = this.bucket * this.rows;
    const margin = span * HeatmapBuffer.MARGIN;
    if (mid <= this.top - margin && mid >= this.top - span + margin) return;

    const newTop = Math.round((mid + span / 2) / this.bucket) * this.bucket;
    const delta = Math.round((newTop - this.top) / this.bucket);
    if (delta === 0) return;

    this.top = newTop;
    for (const column of this.history) shiftRows(column, delta);
  }


  columns(): Column[] {
    return this.history;
  }

  // Drops all history
  // Called when the book is swapped, the stored columns are on a price scale
  // the new book has nothing to do with
  clear(): void {
    this.history = [];
  }

  window(): PriceWindow {
    return {
      top: this.top,
      bucket: this.bucket,
      rows: this.rows
    };
  }



  // Sets cap to the highest p percentile
  // This prevents one huge size crushing every other color to black
  // Allocates an array of every non-zero cell and sorts it (O(nlogn))
  scale(p = 0.98): number {
    const values: number[] = [];
    for (const column of this.history) {
      for (const size of column) if (size > 0) values.push(size);
    }
    if (values.length === 0) return 0;
    values.sort((a, b) => a - b);
    return values[Math.min(values.length - 1, Math.floor(values.length * p))];
  }


  // Max size in prices (O(n))
  maxSize(): number {
    let max = 0;
    for(const column of this.history){
      for(const size of column){
        max = Math.max(max, size);
      }
    }
    return max;
  }
}


// onColumn fires after each sample so the renderer redraws at sampler rate,
// not at ticker rate.
// book is resolved per sample instead of captured, so swapping the source
// doesn't need a new sampler
export function startHeatmapSampler(
  buffer: HeatmapBuffer,
  book: () => BookView,
  hz = 4,
  onColumn?: () => void,
): () => void {
  const timer = setInterval(() => {
    buffer.sample(book());
    onColumn?.();
  }, 1000/hz);

  return () => {clearInterval(timer)}
}
