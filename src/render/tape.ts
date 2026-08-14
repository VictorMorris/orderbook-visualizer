import { Container, Graphics, Text } from 'pixi.js';
import type { TapeTrade } from '../feed/tape';


const ROW_H = 18;      // px per price level
const MAX_BAR = 240;   // px width at the largest size


export function drawTape(trades: TapeTrade[], maxSize: number): Container {

    const tape = new Container();
    for(let i=0; i<trades.length; i++){
        const barLength = (trades[i].size / maxSize) * MAX_BAR;
        const rectangle = new Graphics().rect(0, ROW_H*i, barLength, ROW_H).fill(
            trades[i].aggressor === "sell" ? "red" : "green"
        );
        tape.addChild(rectangle);
        const txt = new Text({ text: trades[i].price.toFixed(2), style: { fontSize: 12, fill: 0xffffff } });
        txt.y = ROW_H * i;
        txt.x = MAX_BAR + 8;
        tape.addChild(txt)
    }

    return tape
}
