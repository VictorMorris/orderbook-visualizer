import { Container, Graphics } from 'pixi.js';
import { cumulative, type Level, type DepthPoint } from './depth';

const WIDTH = 480;   // px, full chart width
const HEIGHT = 160;  // px, y at the largest cumulative total


export function drawDepth(bids: Level[], asks: Level[]): Container {
    const bidPts = cumulative(bids);
    const askPts = cumulative(asks);
    const depthChart = new Container();

    const maxCum = (pts: DepthPoint[]) => (pts.length ? pts[pts.length - 1].cum : 0);
    const yScale = Math.max(maxCum(bidPts), maxCum(askPts)) || 1;
    const spacing = WIDTH / (bidPts.length + askPts.length);
    const centerX = bidPts.length * spacing;

    const graphics = new Graphics();
    const yAt = (cum: number) => HEIGHT - (cum / yScale) * HEIGHT;

    
    const drawSide = (pts: DepthPoint[], xAt: (d: number) => number, color: number) => {
        if (!pts.length) return;
        graphics.moveTo(xAt(0), yAt(0));               // baseline at the spread
        graphics.lineTo(xAt(0), yAt(pts[0].cum));      // riser up to the best level
        for (let k = 1; k < pts.length; k++) {
            graphics.lineTo(xAt(k), yAt(pts[k - 1].cum));  // tread of level k-1
            graphics.lineTo(xAt(k), yAt(pts[k].cum));      // riser to level k
        }
        graphics.lineTo(xAt(pts.length), yAt(pts[pts.length - 1].cum)); // final tread
        graphics.stroke({ width: 2, color });
    };

    drawSide(bidPts, d => centerX - d * spacing, 0x00ff00); // bids step outward left
    drawSide(askPts, d => centerX + d * spacing, 0xff0000); // asks step outward right

    depthChart.addChild(graphics);
    return depthChart;
}
