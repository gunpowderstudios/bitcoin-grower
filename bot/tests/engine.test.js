import {strict as assert} from 'node:assert';
import {DEFAULT_RULES, initialState, step, halt, validRules} from '../engine.js';
assert(validRules(DEFAULT_RULES));
assert(!validRules({...DEFAULT_RULES,buyGBP:11}));
assert(!validRules({...DEFAULT_RULES,budgetGBP:1000}));
let s=initialState(60000);
let t=step(s,59000,'2026-10-12');assert.equal(t.action,null);
t=step(s,57000,'2026-10-12');assert.equal(t.action.side,'BUY');
s=t.state;assert(s.cashGBP===90);assert(s.btc>0);assert(s.lot);
t=step(s,57000,'2026-10-12');assert.equal(t.action,null); // no duplicate buy
t=step(s,62700,'2026-10-12');assert.equal(t.action.side,'SELL');
s=t.state;assert.equal(s.lot,null);assert(s.cashGBP>100);assert(s.btc<1e-10);
t=step(s,59000,'2026-10-12');assert.equal(t.action,null); // daily limit
t=step(s,59000,'2026-10-13');assert.equal(t.action.side,'BUY');
assert.equal(step(halt(s),50000,'2026-10-13').action,null);
assert.equal(step(initialState(150000),140000,'2026-10-12').reason,'Below BTC order minimum');
console.log('Bitcoin Grower paper engine safety tests passed.');
