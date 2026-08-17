// Aggregate resting order size at price
// Exchange sends decimal strings
export type PriceLevel = [price: string, qty: string];

// REST depth snapshot: GET /api/v3/depth?symbol=…&limit=1000
// The top limit levels per side
// Levels deeper than the snapshot are unknown
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
  m: boolean;  // m === true means buyer rested and seller was the aggresser
}

// One @depth diff event off the WebSocket.
// What changed in the order book since the last event
export interface DepthDiff {
  U: number;        // first update id covered by this event
  u: number;        // final update id covered by this event
  b: PriceLevel[];  // bid changes (Absolute quantity)
  a: PriceLevel[];  // ask changes (Absolute quantity)
}
