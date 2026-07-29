// Tests written by Claude

import { OrderBook } from './orderbook';
import type { Order, Trade } from './types';


let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail = ''): void {
    if (cond) { passed++; console.log(`  ok   ${name}`); }
    else { failed++; console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

const tradeKey = (t: Trade) => `${t.price}|${t.size}|${t.makerId}|${t.takerId}`;
const levelKey = (l: { price: number; size: number }) => `${l.price}|${l.size}`;

function eqTrades(actual: Trade[], expected: Trade[]): [boolean, string] {
    const a = actual.map(tradeKey), e = expected.map(tradeKey);
    return [a.length === e.length && a.every((x, i) => x === e[i]),
            `got [${a.join(', ')}] want [${e.join(', ')}]`];
}

function eqLevels(actual: { price: number; size: number }[],
                  expected: { price: number; size: number }[]): [boolean, string] {
    const a = actual.map(levelKey), e = expected.map(levelKey);
    return [a.length === e.length && a.every((x, i) => x === e[i]),
            `got [${a.join(', ')}] want [${e.join(', ')}]`];
}

const ord = (id: string, side: Order['side'], price: number, size: number): Order =>
    ({ id, side, price, size });

// 1. Resting orders, no cross
{
    console.log('resting orders (no cross)');
    const b = new OrderBook();
    check('ask rests, no trades', eqTrades(b.submit(ord('a1', 'ask', 101, 5)), [])[0]);
    check('bid rests, no trades', eqTrades(b.submit(ord('b1', 'bid', 99, 3)), [])[0]);
    check('bestBid = 99', b.bestBid() === 99);
    check('bestAsk = 101', b.bestAsk() === 101);
    const [okA] = eqLevels(b.levels('ask'), [{ price: 101, size: 5 }]);
    const [okB] = eqLevels(b.levels('bid'), [{ price: 99, size: 3 }]);
    check('ask level', okA);
    check('bid level', okB);
}

// 2. Two-level sweep, remainder rests
{
    console.log('two-level crossing sweep');
    const b = new OrderBook();
    b.submit(ord('a1', 'ask', 99, 4));
    b.submit(ord('a2', 'ask', 100, 5));
    b.submit(ord('a3', 'ask', 101, 9));
    const trades = b.submit(ord('t1', 'bid', 100, 10));
    const [ok, why] = eqTrades(trades, [
        { price: 99, size: 4, makerId: 'a1', takerId: 't1' },
        { price: 100, size: 5, makerId: 'a2', takerId: 't1' },
    ]);
    check('trades: fill 99 then 100', ok, why);
    check('bestAsk now 101', b.bestAsk() === 101);
    const [okBid, whyBid] = eqLevels(b.levels('bid'), [{ price: 100, size: 1 }]);
    check('remainder 1 rests at bid 100', okBid, whyBid);
    const [okAsk, whyAsk] = eqLevels(b.levels('ask'), [{ price: 101, size: 9 }]);
    check('levels 99 & 100 consumed', okAsk, whyAsk);
}

// 3. Partial fill of maker, taker fully filled, nothing rests
{
    console.log('partial fill of resting maker');
    const b = new OrderBook();
    b.submit(ord('a1', 'ask', 99, 5));
    const trades = b.submit(ord('t1', 'bid', 100, 3));
    const [ok, why] = eqTrades(trades, [{ price: 99, size: 3, makerId: 'a1', takerId: 't1' }]);
    check('one trade for 3', ok, why);
    check('bestBid undefined (taker fully filled)', b.bestBid() === undefined);
    const [okAsk, whyAsk] = eqLevels(b.levels('ask'), [{ price: 99, size: 2 }]);
    check('maker shrinks to 2', okAsk, whyAsk);
}

// 4. Exact fill, level removed
{
    console.log('exact fill empties level');
    const b = new OrderBook();
    b.submit(ord('a1', 'ask', 99, 5));
    const trades = b.submit(ord('t1', 'bid', 100, 5));
    const [ok, why] = eqTrades(trades, [{ price: 99, size: 5, makerId: 'a1', takerId: 't1' }]);
    check('one trade for 5', ok, why);
    check('bestAsk undefined (level deleted)', b.bestAsk() === undefined);
    check('bestBid undefined (nothing rests)', b.bestBid() === undefined);
    check('ask levels empty', b.levels('ask').length === 0);
}

// 5. No cross, taker rests
{
    console.log('no cross, taker rests');
    const b = new OrderBook();
    b.submit(ord('a1', 'ask', 101, 5));
    const trades = b.submit(ord('t1', 'bid', 100, 2));
    check('no trades', trades.length === 0);
    check('bestBid = 100', b.bestBid() === 100);
    check('bestAsk untouched = 101', b.bestAsk() === 101);
}

// 6. Empty book
{
    console.log('submit into empty book');
    const b = new OrderBook();
    const trades = b.submit(ord('t1', 'bid', 100, 2));
    check('no trades', trades.length === 0);
    check('rests at 100', b.bestBid() === 100);
}

// 7. Price-time priority: earliest at a level fills first
{
    console.log('FIFO price-time priority');
    const b = new OrderBook();
    b.submit(ord('a1', 'ask', 100, 3)); // earlier
    b.submit(ord('a2', 'ask', 100, 4)); // later, same price
    const trades = b.submit(ord('t1', 'bid', 100, 3));
    const [ok, why] = eqTrades(trades, [{ price: 100, size: 3, makerId: 'a1', takerId: 't1' }]);
    check('earliest maker a1 fills first', ok, why);
    const [okAsk, whyAsk] = eqLevels(b.levels('ask'), [{ price: 100, size: 4 }]);
    check('a2 remains with size 4', okAsk, whyAsk);
}

// 8. Cancel shrinks a level
{
    console.log('cancel shrinks a level');
    const b = new OrderBook();
    b.submit(ord('a1', 'ask', 100, 3));
    b.submit(ord('a2', 'ask', 100, 4));
    b.cancel('a1');
    const [ok, why] = eqLevels(b.levels('ask'), [{ price: 100, size: 4 }]);
    check('level holds only a2', ok, why);
    check('bestAsk still 100', b.bestAsk() === 100);
}

// 9. Cancel removes an empty level
{
    console.log('cancel removes the level');
    const b = new OrderBook();
    b.submit(ord('a1', 'ask', 100, 3));
    b.cancel('a1');
    check('ask levels empty', b.levels('ask').length === 0);
    check('bestAsk undefined', b.bestAsk() === undefined);
}

// 10. Cancel unknown id is a safe no-op
{
    console.log('cancel unknown id');
    const b = new OrderBook();
    b.submit(ord('a1', 'ask', 100, 3));
    b.cancel('nope');
    check('no throw, level intact', b.bestAsk() === 100);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
