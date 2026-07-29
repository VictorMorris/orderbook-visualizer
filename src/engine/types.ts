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