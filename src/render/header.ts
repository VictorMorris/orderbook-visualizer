import { Container, Graphics, Text } from 'pixi.js';
import { COLOR, TEXT } from './theme';
import { fmtPrice } from './format';

// Top strip: instrument and venue on the left, live mid and spread on the right.
export class HeaderView {
  readonly container = new Container();
  private rule = new Graphics();
  private symbol = new Text({ text: 'BTC/USDT', style: TEXT.big });
  private venue = new Text({ text: 'BINANCE · LIVE DEPTH + AGGTRADE', style: TEXT.title });
  private mid = new Text({ text: '—', style: TEXT.big });
  private spread = new Text({ text: '', style: TEXT.label });
  private lastMid?: number;   // previous mid, for tick-direction colouring


  constructor(w: number, h: number) {
    this.container.addChild(this.rule);


    // Left column: symbol on the first line, venue caption under it.
    this.symbol.x = 0;
    this.symbol.y = 0;
    this.venue.x = 0;
    this.venue.y = 32;

    // Right column: anchored at x=1 so both readouts stay flush to the right
    // edge as their text length changes.
    this.mid.anchor.set(1, 0);
    this.mid.x = w;
    this.spread.anchor.set(1, 0);
    this.spread.x = w;
    this.spread.y = 32;

    this.container.addChild(this.symbol, this.venue, this.mid, this.spread);
    // Border between the header and below panels
    this.rule.moveTo(0, h).lineTo(w, h).stroke({ width: 1, color: COLOR.border });
  }

  // Called every frame
  // Cheap enough to run unconditionally
  update(bid: number | undefined, ask: number | undefined): void {
    // No book yet: the feed is still buffering diffs before its first snapshot.
    if (bid === undefined || ask === undefined) {
      this.mid.text = '—';
      this.spread.text = 'WAITING FOR SNAPSHOT';
      return;
    }
    const mid = (bid + ask) / 2;
    // Colour the mid by tick direction
    if (this.lastMid !== undefined && mid !== this.lastMid) {
      this.mid.style.fill = mid > this.lastMid ? COLOR.bid : COLOR.ask;
    }
    this.lastMid = mid;   // unchanged mid keeps the previous colour

    this.mid.text = fmtPrice(mid);
    // Spread in absolute terms and in basis points
    this.spread.text = `SPREAD ${(ask - bid).toFixed(2)} · ${((ask - bid) / mid * 10000).toFixed(1)} BP`;
  }
}
