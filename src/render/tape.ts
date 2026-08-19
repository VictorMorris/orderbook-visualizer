import { Container, Graphics, Text } from 'pixi.js';
import { COLOR, TEXT } from './theme';
import { fmtPrice, fmtSize, fmtTime } from './format';
import { Flash, Smooth } from './motion';
import type { TapeTrade } from '../feed/tape';

const ROW_H = 16;

// Newest trades print at the top, one row per trade

export class TapeView {
  readonly container = new Container();
  private bars = new Graphics();
  private time: Text[] = [];
  private price: Text[] = [];
  private size: Text[] = [];
  private scale = new Smooth();   // smoothed size divisor for bar widths
  private fresh = new Flash(600); // 600ms glow on each newly seen trade, keyed by trade id
  private lastId = -1;            // high-water mark: the tape re-sends trades every frame
  private rows: number;

  private w:number;

  constructor(w: number, h: number) {
    this.w = w;
    
    // Row count is derived from panel height
    this.rows = Math.floor(h / ROW_H);
    this.container.addChild(this.bars);

    // time | price | size, left / right-of-size / right edge.
    for (let i = 0; i < this.rows; i++) {
      const t = new Text({ text: '', style: TEXT.label });
      t.x = 0;
      const p = new Text({ text: '', style: TEXT.price });
      p.anchor.set(1, 0);
      p.x = w - 66;
      const s = new Text({ text: '', style: TEXT.label });
      s.anchor.set(1, 0);
      s.x = w;
      this.container.addChild(t, p, s);
      this.time.push(t);
      this.price.push(p);
      this.size.push(s);
    }
  }

  // `trades` is newest-first (TradeTape.recent), `peak` the largest size it holds.
  update(trades: TapeTrade[], peak: number, dt: number, now: number): void {
    // Only ids above the high-water mark are new, so a trade glows once on arrival
    for (const t of trades) if (t.id > this.lastId) this.fresh.hit(t.id, now);
    if (trades.length) this.lastId = Math.max(this.lastId, trades[0].id);

    const scale = this.scale.to(peak || 1, dt) || 1;
    this.bars.clear();

    for (let i = 0; i < this.rows; i++) {
      const trade = trades[i];
      const y = i * ROW_H;

      // Fewer trades than rows, blank the row, keep it in place.
      if (!trade) {
        this.time[i].text = '';
        this.price[i].text = '';
        this.size[i].text = '';
        continue;
      }

      // Colour by aggressor: a buy lifted the offer, a sell hit the bid.
      const buy = trade.aggressor === 'buy';
      const fg = buy ? COLOR.bid : COLOR.ask;
      // sqrt not linear
      // A linear bar leaves every ordinary trade at zero width beside one whale
      const width = Math.max(Math.sqrt(trade.size / scale) * this.w, 1);

      // Faint size bar behind the text, plus a 2px rail so small prints stay visible.
      this.bars.rect(0, y + 1, width, ROW_H - 2).fill({ color: fg, alpha: 0.16 });
      this.bars.rect(0, y + 1, 2, ROW_H - 2).fill({ color: fg });

      // Arrival glow, tinted by side and fading over Flash's decay window.
      const glow = this.fresh.alpha(trade.id, now);
      if (glow > 0) {
        this.bars.rect(0, y + 1, this.w, ROW_H - 2).fill({ color: fg, alpha: glow * 0.18 });
      }

      this.time[i].text = fmtTime(trade.time);
      this.time[i].y = y + 3;
      this.price[i].text = fmtPrice(trade.price);
      this.price[i].style.fill = fg;
      this.price[i].y = y + 2;
      this.size[i].text = fmtSize(trade.size);
      this.size[i].y = y + 3;
    }
  }
}
