import { Container, Graphics, Text } from 'pixi.js';
import { COLOR, TEXT } from './theme';
import { fmtPrice } from './format';
import type { SourceKind } from '../driver/session';

const SEG_W = 104;
const SEG_H = 26;
const TOGGLE_X = 300;
const TOGGLE_Y = 8;

// Caption under the symbol
const VENUE: Record<SourceKind, string> = {
  live: 'BINANCE · LIVE DEPTH + AGGTRADE',
  synthetic: 'SIMULATED · LOCAL MATCHING ENGINE',
};

// One half of the source toggle
class Segment {
  readonly container = new Container();
  private readonly box = new Graphics();
  private readonly label: Text;
  private readonly w: number;
  private readonly h: number;

  constructor(text: string, w: number, h: number, onTap: () => void) {
    this.w = w;
    this.h = h;
    this.label = new Text({ text, style: { ...TEXT.title } });   // copy: setActive mutates fill
    this.label.anchor.set(0.5);
    this.label.x = w / 2;
    this.label.y = h / 2;
    this.container.addChild(this.box, this.label);

    
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';
    this.container.on('pointertap', onTap);

    this.setActive(false);
  }

  // Selected is filled with an accent border, unselected is flat and muted
  setActive(active: boolean): void {
    this.box.clear()
      .rect(0, 0, this.w, this.h)
      .fill(active ? COLOR.grid : COLOR.panel)
      .stroke({ width: 1, color: active ? COLOR.accent : COLOR.dim, alignment: 0 });
    this.label.style.fill = active ? COLOR.accent : COLOR.muted;
  }
}

// Two segment control
// Clicking reports the choice, main.ts calls setSource once the swap has happened
class SourceToggle {
  readonly container = new Container();
  private readonly segments: Record<SourceKind, Segment>;

  constructor(onSelect: (kind: SourceKind) => void) {
    this.segments = {
      live: new Segment('LIVE', SEG_W, SEG_H, () => onSelect('live')),
      synthetic: new Segment('SYNTHETIC', SEG_W, SEG_H, () => onSelect('synthetic')),
    };
    this.segments.synthetic.container.x = SEG_W - 1;   // overlap by a pixel to share the border
    this.container.addChild(this.segments.live.container, this.segments.synthetic.container);
  }

  setSource(kind: SourceKind): void {
    this.segments.live.setActive(kind === 'live');
    this.segments.synthetic.setActive(kind === 'synthetic');
    // Selected segment goes last, it owns the border the two share
    this.container.addChild(this.segments[kind].container);
  }
}

// Top strip: instrument, venue and source toggle on the left, live mid and spread on the right.
export class HeaderView {
  readonly container = new Container();
  private rule = new Graphics();
  private symbol = new Text({ text: 'BTC/USDT', style: TEXT.big });
  private venue = new Text({ text: '', style: TEXT.title });
  private mid = new Text({ text: '—', style: TEXT.big });
  private spread = new Text({ text: '', style: TEXT.label });
  private toggle: SourceToggle;
  private lastMid?: number;   // previous mid, for tick-direction colouring


  constructor(w: number, h: number, source: SourceKind, onSelect: (kind: SourceKind) => void) {
    this.container.addChild(this.rule);


    // Left column: symbol on the first line, venue caption under it.
    this.symbol.x = 0;
    this.symbol.y = 0;
    this.venue.x = 0;
    this.venue.y = 32;

    // Toggle sits clear of the symbol's widest rendering
    this.toggle = new SourceToggle(onSelect);
    this.toggle.container.x = TOGGLE_X;
    this.toggle.container.y = TOGGLE_Y;

    // Right column: anchored at x=1 so both readouts stay flush to the right
    // edge as their text length changes.
    this.mid.anchor.set(1, 0);
    this.mid.x = w;
    this.spread.anchor.set(1, 0);
    this.spread.x = w;
    this.spread.y = 32;

    this.container.addChild(this.symbol, this.venue, this.toggle.container, this.mid, this.spread);
    // Border between the header and below panels
    this.rule.moveTo(0, h).lineTo(w, h).stroke({ width: 1, color: COLOR.border });

    this.setSource(source);
  }

  // Called after the session has been swapped
  setSource(kind: SourceKind): void {
    this.toggle.setSource(kind);
    this.venue.text = VENUE[kind];
    // The new book's mid has nothing to do with the old one
    // Drop the reference price instead of colouring a meaningless tick
    this.lastMid = undefined;
    this.mid.style.fill = COLOR.text;
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
