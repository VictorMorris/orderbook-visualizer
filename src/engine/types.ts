export type Side = 'bid' | 'ask';

export interface Order {
  id: string;
  side: Side;
  price: number;
  size: number;
}

export interface Trade {
  price: number;
  size: number;
  makerId: string;
  takerId: string;
}

// Read-only view the renderer draws. OrderBook (matching) and DepthBook (live
// feed) both satisfy it, so render/ never learns which kind of book it holds.
export interface BookView {
  bestBid(): number | undefined;
  bestAsk(): number | undefined;
  levels(side: Side): { price: number; size: number }[];
}