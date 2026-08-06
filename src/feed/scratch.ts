// Tests written by Claude

import { DepthBook } from './depthBook';
import type { PriceLevel } from './types';

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail = ''): void {
    if (cond) { passed++; console.log(`  ok   ${name}`); }
    else { failed++; console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

const levelKey = (l: { price: number; size: number }) => `${l.price}|${l.size}`;
function eqLevels(actual: { price: number; size: number }[],
                  expected: { price: number; size: number }[]): [boolean, string] {
    const a = actual.map(levelKey), e = expected.map(levelKey);
    return [a.length === e.length && a.every((x, i) => x === e[i]),
            `got [${a.join(', ')}] want [${e.join(', ')}]`];
}

const pl = (price: number | string, qty: number | string): PriceLevel => [`${price}`, `${qty}`];

// 1. reset: levels sorted (bids high→low, asks low→high), best prices correct
{
    console.log('reset + sorted reads');
    const d = new DepthBook();
    d.reset([pl(99, 3), pl(98, 7), pl(100, 1)], [pl(102, 4), pl(101, 5), pl(103, 2)]);
    check('bestBid = 100 (highest bid)', d.bestBid() === 100);
    check('bestAsk = 101 (lowest ask)', d.bestAsk() === 101);
    const [okB, whyB] = eqLevels(d.levels('bid'), [
        { price: 100, size: 1 }, { price: 99, size: 3 }, { price: 98, size: 7 }]);
    check('bids sorted high→low', okB, whyB);
    const [okA, whyA] = eqLevels(d.levels('ask'), [
        { price: 101, size: 5 }, { price: 102, size: 4 }, { price: 103, size: 2 }]);
    check('asks sorted low→high', okA, whyA);
}

// 2. applyDiff sets ABSOLUTE size — it overwrites, it does not add
{
    console.log('diff overwrites (absolute, not delta)');
    const d = new DepthBook();
    d.reset([pl(100, 10)], []);
    d.applyDiff([pl(100, 3)], []);
    const [ok, why] = eqLevels(d.levels('bid'), [{ price: 100, size: 3 }]);
    check('bid 100 becomes 3, not 13', ok, why);
}

// 3. qty "0" removes the level; best price moves to the next one
{
    console.log('qty 0 removes a level');
    const d = new DepthBook();
    d.reset([], [pl(101, 5), pl(102, 8)]);
    d.applyDiff([], [pl(101, 0)]);
    check('bestAsk moves 101 → 102', d.bestAsk() === 102);
    const [ok, why] = eqLevels(d.levels('ask'), [{ price: 102, size: 8 }]);
    check('101 gone, 102 remains', ok, why);
}

// 4. a diff naming a new price inserts it in sorted position
{
    console.log('diff inserts a new level');
    const d = new DepthBook();
    d.reset([], [pl(101, 5), pl(103, 8)]);
    d.applyDiff([], [pl(102, 6)]);
    const [ok, why] = eqLevels(d.levels('ask'), [
        { price: 101, size: 5 }, { price: 102, size: 6 }, { price: 103, size: 8 }]);
    check('102 lands between 101 and 103', ok, why);
    check('bestAsk still 101', d.bestAsk() === 101);
}

// 5. string prices must sort NUMERICALLY, not lexicographically ("9" > "100")
{
    console.log('numeric (not lexicographic) sort');
    const d = new DepthBook();
    d.reset([pl(9, 1), pl(100, 1), pl(11, 1)], []);
    check('bestBid = 100, not 9', d.bestBid() === 100);
    const [ok, why] = eqLevels(d.levels('bid'), [
        { price: 100, size: 1 }, { price: 11, size: 1 }, { price: 9, size: 1 }]);
    check('bids ordered 100, 11, 9', ok, why);
}

// 6. reset replaces ALL prior state — both sides, no stale levels survive
{
    console.log('reset clears prior state');
    const d = new DepthBook();
    d.reset([pl(99, 3)], [pl(101, 5)]);
    d.reset([pl(50, 2)], [pl(60, 4)]);
    check('bestBid = 50 (old 99 gone)', d.bestBid() === 50);
    check('bestAsk = 60 (old 101 gone)', d.bestAsk() === 60);
    const [okB] = eqLevels(d.levels('bid'), [{ price: 50, size: 2 }]);
    const [okA] = eqLevels(d.levels('ask'), [{ price: 60, size: 4 }]);
    check('single bid level survives', okB);
    check('single ask level survives', okA);
}

// 7. empty book reads
{
    console.log('empty book');
    const d = new DepthBook();
    check('bestBid undefined', d.bestBid() === undefined);
    check('bestAsk undefined', d.bestAsk() === undefined);
    check('bid levels empty', d.levels('bid').length === 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
