// Tests written by Claude
// Run with npx tsx src/driver/scratch.ts

import { OrderBook } from '../engine/orderbook';
import type { Side, Trade } from '../engine/types';
import { startSyntheticFlow } from './synthetic';

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail = ''): void {
    if (cond) { passed++; console.log(`  ok   ${name}`); }
    else { failed++; console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

const MID = 100000;
const TICK = 1;
const book = new OrderBook();
const trades: Trade[] = [];
const takers: Side[] = [];

const stop = startSyntheticFlow(book, {
    mid: MID, hz: 200, tick: TICK, spread: 18, size: 0.2,
    target: 400, aggression: 0.15, drift: 0.25, warmup: 500,
    onTrade: (ts, taker) => { for (const t of ts) { trades.push(t); takers.push(taker); } },
});

// The warmup runs before any timer fires, so there is a two sided book already
const bids0 = book.levels('bid');
const asks0 = book.levels('ask');
check('warmup fills both sides', bids0.length > 0 && asks0.length > 0,
      `${bids0.length} bid levels, ${asks0.length} ask levels`);
check('warmup rests without crossing', book.bestBid()! < book.bestAsk()!,
      `bid ${book.bestBid()} ask ${book.bestAsk()}`);
check('warmup prints nothing', trades.length === 0, `${trades.length} trades`);
check('warmup brackets the seed mid', book.bestBid()! <= MID && book.bestAsk()! >= MID,
      `bid ${book.bestBid()} ask ${book.bestAsk()} around ${MID}`);

// Polls while the flow runs
// A crossed book at any instant is the bug that matters, and checking only the
// final state would miss it
let crossed = 0;
let offGrid = 0;
let peakLevels = 0;
const poll = setInterval(() => {
    const bid = book.bestBid(), ask = book.bestAsk();
    if (bid !== undefined && ask !== undefined && bid >= ask) crossed++;
    for (const side of ['bid', 'ask'] as Side[]) {
        const levels = book.levels(side);
        peakLevels = Math.max(peakLevels, levels.length);
        for (const l of levels) if (l.price % TICK !== 0) offGrid++;
    }
}, 10);

setTimeout(() => {
    stop();
    clearInterval(poll);

    check('never crosses while running', crossed === 0, `${crossed} crossed samples`);
    check('every price lands on the tick grid', offGrid === 0, `${offGrid} off-grid levels`);
    check('prints trades', trades.length > 0, `${trades.length} trades`);
    check('both sides aggress', takers.includes('bid') && takers.includes('ask'));
    check('trade sizes are positive', trades.every(t => t.size > 0));
    check('maker and taker are never the same order', trades.every(t => t.makerId !== t.takerId));

    // The add/cancel mix should hold the book near target, not let it grow forever
    const total = book.levels('bid').length + book.levels('ask').length;
    check('book size stays bounded', peakLevels < 400, `peak ${peakLevels} levels on a side`);

    const bids = book.levels('bid'), asks = book.levels('ask');
    check('bids sorted descending', bids.every((l, i) => i === 0 || bids[i - 1].price > l.price));
    check('asks sorted ascending', asks.every((l, i) => i === 0 || asks[i - 1].price < l.price));
    check('book stays deep', total > 40, `${total} levels`);

    console.log(`\n${passed} passed, ${failed} failed`);
    console.log(`  ${trades.length} trades, ${total} levels, mid ${(book.bestBid()! + book.bestAsk()!) / 2}`);
    process.exit(failed === 0 ? 0 : 1);
}, 3000);
