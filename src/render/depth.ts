export type Level = { price: number; size: number };
export type DepthPoint = { price: number; cum: number };


export function cumulative(levels: Level[]): DepthPoint[] {
    const depth: DepthPoint[] = [];
    let last = 0;
    for (const level of levels) {
        depth.push({ price: level.price, cum: last + level.size });
        last += level.size;
    }
    return depth;
}
