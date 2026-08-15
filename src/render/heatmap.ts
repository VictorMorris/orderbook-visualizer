import type { BookView } from '../engine/types';



export type Column = Float32Array;


export interface PriceWindow {
  top: number;     // price of row 0
  bucket: number;  // price per row
  rows: number;
}

export class HeatmapBuffer {
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


  private reanchor(mid: number): void {}


  columns(): Column[] {
    return this.history.slice(0, 25);
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


export function startHeatmapSampler(buffer: HeatmapBuffer, book: BookView, hz = 4): () => void {
  const timer = setInterval(() => {
    buffer.sample(book);
  }, 1000/hz);
  
  return () => {clearInterval(timer)}
}
