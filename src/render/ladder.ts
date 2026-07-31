import { Container, Graphics } from 'pixi.js';

type Level = { price: number; size: number };

const ROW_H = 18;      // px per price level
const MAX_BAR = 240;   // px width at the largest size

export function drawLadder(bids: Level[], asks: Level[]): Container {
    const ladder = new Container();

    let maxSize = 1;
    for(const book of [bids, asks]) {
        for(const level of book) {
            if(level.size > maxSize) maxSize = level.size;
        }
    }

    for(let i=0; i<asks.length; i++) {
        const barLength = (asks[i].size / maxSize) * MAX_BAR;
        const rectangle = new Graphics().rect(0, ROW_H*(asks.length-1-i), barLength, ROW_H).fill("red");
        ladder.addChild(rectangle);
    }

    for(let i=0; i<bids.length; i++) {
        const barLength = (bids[i].size / maxSize) * MAX_BAR;
        const rectangle = new Graphics().rect(0, ROW_H*i + asks.length*ROW_H, barLength, ROW_H).fill("green");
        ladder.addChild(rectangle);
    }

    return ladder
};