// This file sits in render because it is a presentation concern rather than a book concern
export type Level = { price: number; size: number };
export type DepthPoint = { price: number; cum: number };

// Gives the size through each price
export function cumulative(levels: Level[]): DepthPoint[] {
    const depth: DepthPoint[] = [];
    let last = 0;
    for (const level of levels) {
        depth.push({ price: level.price, cum: last + level.size });
        last += level.size;
    }
    return depth;
}
