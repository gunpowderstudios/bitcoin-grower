// Bitcoin Grower — deterministic paper-trading decision engine.
// This module has NO Kraken credentials, private endpoints or order execution.
// No external packages, no persistence and no permissions to place orders.
export const DEFAULT_RULES = Object.freeze({
  budgetGBP: 100, buyGBP: 10, dipPct: 5, reboundPct: 10,
  feePct: 0.4, maxOpenLots: 1, maxTradesPerDay: 2,
  minimumOrderBTC: 0.0001
});
export function validRules(r) {
  return !!r && Object.values(r).every(Number.isFinite) &&
    r.budgetGBP === 100 && r.buyGBP > 0 && r.buyGBP <= 10 &&
    r.dipPct >= 1 && r.dipPct <= 30 &&
    r.reboundPct >= 1 && r.reboundPct <= 100 &&
    r.feePct >= 0 && r.feePct <= 3 &&
    r.maxOpenLots === 1 && r.maxTradesPerDay >= 1 &&
    r.maxTradesPerDay <= 2 && r.minimumOrderBTC > 0;
}
export function initialState(price, rules = DEFAULT_RULES) {
  if (!validRules(rules) || !Number.isFinite(price) || price <= 0) throw new Error('Invalid setup');
  return { cashGBP: rules.budgetGBP, btc: 0, buyReference: price, lot: null,
    trades: [], day: '', tradesToday: 0, halted: false };
}
export function step(previous, price, day, rules = DEFAULT_RULES) {
  if (!validRules(rules) || !Number.isFinite(price) || price <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Invalid input');
  const s = structuredClone(previous);
  if (s.halted) return { state:s, action:null, reason:'Emergency stop enabled' };
  if (s.day !== day) { s.day = day; s.tradesToday = 0; }
  if (s.tradesToday >= rules.maxTradesPerDay) return { state:s, action:null, reason:'Daily trade limit' };
  const fee = rules.feePct / 100;
  // Exactly one purchased lot can be held by this engine.
  if (s.lot) {
    if (price < s.lot.price * (1 + rules.reboundPct / 100))
      return {state:s, action:null, reason:'Waiting for rebound'};
    const proceeds = s.lot.btc * price * (1-fee);
    if (s.lot.btc < rules.minimumOrderBTC)
      return {state:s, action:null, reason:'Below BTC order minimum'};
    const action={side:'SELL',btc:s.lot.btc, estimatedGBP:proceeds, price};
    s.cashGBP += proceeds; s.btc -= s.lot.btc;
    s.tradesToday++; s.trades.push({day,...action}); s.lot=null;
    s.buyReference=price;
    return {state:s,action,reason:'Harvest full lot; no existing BTC touched'};
  }
  if (price > s.buyReference * (1-rules.dipPct/100))
    return {state:s, action:null, reason:'Waiting for dip'};
  if (s.cashGBP < rules.buyGBP)
    return {state:s,action:null,reason:'Insufficient virtual cash'};
  const btc = rules.buyGBP*(1-fee)/price;
  if (btc < rules.minimumOrderBTC)
    return {state:s,action:null,reason:'Below BTC order minimum'};
  const action={side:'BUY',btc,estimatedGBP:rules.buyGBP,price};
  s.cashGBP -= rules.buyGBP; s.btc += btc;
  s.lot={btc,price}; s.buyReference=price;
  s.tradesToday++;s.trades.push({day,...action});
  return {state:s,action,reason:'Bought dip within virtual budget'};
}
export function halt(state) {return {...state,halted:true};}
