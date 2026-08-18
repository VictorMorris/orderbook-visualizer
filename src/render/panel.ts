import { Container, Graphics, Text } from 'pixi.js';
import { COLOR, TEXT } from './theme';

export interface Rect { x: number; y: number; w: number; h: number }

// Fixed grid against DESIGN_W x DESIGN_H
export const PANEL: Record<
  'header' | 'ladder' | 'heatmap' | 'tape' | 'depth' | 'stats',
  Rect
> = {
  header:  { x: 40,   y: 28,  w: 1520, h: 48  },
  ladder:  { x: 40,   y: 96,  w: 300,  h: 470 },
  heatmap: { x: 372,  y: 96,  w: 1188, h: 470 },
  tape:    { x: 40,   y: 598, w: 300,  h: 262 },
  depth:   { x: 372,  y: 598, w: 740,  h: 262 },
  stats:   { x: 1144, y: 598, w: 416,  h: 262 },
};

export const TITLE_H = 26;
export const PAD = 12;

// Area inside a panel below its title bar.
export function contentRect(rect: Rect): Rect {
  return {
    x: rect.x + PAD,
    y: rect.y + TITLE_H,
    w: rect.w - PAD * 2,
    h: rect.h - TITLE_H - PAD,
  };
}

// Static frame: filled panel, hairline border, title, rule under the title.
// Drawn once at startup
export function drawPanelFrame(title: string, rect: Rect, note = ''): Container {
  const frame = new Container();
  frame.x = rect.x;
  frame.y = rect.y;

  const g = new Graphics()
    .rect(0, 0, rect.w, rect.h)
    .fill(COLOR.panel)
    .stroke({ width: 1, color: COLOR.border, alignment: 0 });
  g.moveTo(0, TITLE_H - 6).lineTo(rect.w, TITLE_H - 6).stroke({ width: 1, color: COLOR.border });
  frame.addChild(g);

  const label = new Text({ text: title.toUpperCase(), style: TEXT.title });
  label.x = PAD;
  label.y = 7;
  frame.addChild(label);

  if (note) {
    const right = new Text({ text: note, style: TEXT.label });
    right.anchor.set(1, 0);
    right.x = rect.w - PAD;
    right.y = 7;
    frame.addChild(right);
  }

  return frame;
}
