import type { BookView } from '../engine/types';



export type Column = Float32Array;


export interface PriceWindow {
  top: number;     // price of row 0
  bucket: number;  // price per row
  rows: number;
}

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
    maxColumns = 120,
    bucket = 1,
    top = 100,
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
    
    this.reanchor((ask + bid)/2)
    const column:Column = new Float32Array(this.rows)
    for(const {price, size} of book.levels('ask')) {
      const row = this.rowOf(price);
      if(row>=0) column[row] += size;
    }
    for(const {price, size} of book.levels('bid')) {
      const row = this.rowOf(price);
      if(row>=0) column[row] += size;
    }

    this.history.push(column);
    if(this.history.length > this.maxColumns) this.history.shift();
  }


  private rowOf(price: number): number {
    if(this.top >= price && price > this.top-(this.bucket*this.rows)){
      return Math.floor((this.top-price)/this.bucket);
    } else return -1;
  }



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

  window(): PriceWindow {
    return {
      top: this.top,
      bucket: this.bucket,
      rows: this.rows
    };
  }


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
export function startHeatmapSampler(
  buffer: HeatmapBuffer,
  book: BookView,
  hz = 4,
  onColumn?: () => void,
): () => void {
  const timer = setInterval(() => {
    buffer.sample(book);
    onColumn?.();
  }, 1000/hz);

  return () => {clearInterval(timer)}
}
