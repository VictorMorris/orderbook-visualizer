// Raw wire shapes from Binance market-data streams. These stay in feed/ — the
// engine never sees them.

// A single [price, quantity] pair. Both are decimal strings on the wire.
export type PriceLevel = [price: string, qty: string];

// REST depth snapshot: GET /api/v3/depth?symbol=…&limit=1000
export interface DepthSnapshot {
  lastUpdateId: number;
  bids: PriceLevel[];
  asks: PriceLevel[];
}

// One @aggTrade event off the WebSocket.
export interface AggTrade {
  a: number;   // aggregate trade id
  p: string;   // price
  q: string;   // quantity
  T: number;   // trade time, ms epoch
  m: boolean;  // true = buyer was the maker, i.e. a SELL took the bid
}

// One @depth diff event off the WebSocket.
export interface DepthDiff {
  U: number;        // first update id covered by this event
  u: number;        // final update id covered by this event
  b: PriceLevel[];  // bid changes (absolute qty; "0" removes the level)
  a: PriceLevel[];  // ask changes
}
