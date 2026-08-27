import { feeFor, POLICY } from './shipping.mjs';

/**
 * 금액대별 쿠폰 (알라딘: 3만↑2천, 5만↑5천, 7만↑7천).
 *
 * ⚠️ 자동 적용이 아니다. 상품 페이지에 "최대 7,000원 할인쿠폰 **받기**"로 표기되고,
 *    "8월 음반 전종 쿠폰 이벤트"라는 기간 한정 행사다 (2026-08-27 브라우저 확인).
 *    그래서 총액에서 빼지 않고 "쿠폰 적용 시" 별도 항목으로만 보여준다.
 */
export function couponFor(items, subtotal) {
  const all = items.flatMap((i) => i.coupons || []);
  if (!all.length) return { amount: 0, why: null };
  const best = all.filter((c) => subtotal >= c.over).sort((a, b) => b.amount - a.amount)[0];
  return best
    ? { amount: best.amount, why: `${(best.over / 10000).toFixed(0)}만원 이상 · 받기 필요` }
    : { amount: 0, why: null };
}

/**
 * "이 버전들을 전부 모으려면 어디서 어떻게 사는 게 최저 총액인가"
 *
 * 팬이 트윗에 "합배송 9곳"이라고만 세는 그 축을 실제 계산으로 바꾼다.
 * 각 버전을 어느 판매처에서 살지 조합을 완전탐색한다 (버전 수가 10 미만이라 가능).
 */
export function optimize(rows, { currency = 'KRW' } = {}) {
  // 통화가 섞이면(Ktown4u USD) 비교가 안 되므로 제외
  const usable = rows.filter((r) => r.price != null && (r.currency || 'KRW') === currency);

  // 버전(key)별 후보 판매처
  const byKey = new Map();
  for (const r of usable) {
    if (!byKey.has(r.key)) byKey.set(r.key, []);
    byKey.get(r.key).push(r);
  }
  const keys = [...byKey.keys()];
  if (keys.length === 0) return null;

  // 버전마다 판매처를 고르는 완전탐색은 조합이 폭발한다 (19종이면 4^19).
  // 배송비는 "어느 판매처를 쓰느냐"에만 붙으므로, 판매처 부분집합(2^4=16가지)을
  // 훑고 그 안에서 버전별 최저가를 고르면 된다. 정확하고 빠르다.
  const retailers = [...new Set(usable.map((r) => r.retailer))];
  if (retailers.length > 12) return null;

  let best = null;
  const evaluate = (subset) => {
    const chosen = [];
    for (const k of keys) {
      const cands = byKey.get(k).filter((c) => subset.includes(c.retailer));
      if (!cands.length) return; // 이 부분집합으로는 전 버전을 못 채운다
      chosen.push(cands.reduce((a, b) => (a.price <= b.price ? a : b)));
    }
    {
      const perRetailer = new Map();
      for (const c of chosen) {
        if (!perRetailer.has(c.retailer)) perRetailer.set(c.retailer, []);
        perRetailer.get(c.retailer).push(c);
      }
      let goods = 0;
      let ship = 0;
      let coupon = 0;
      let unknown = false;
      const breakdown = [];
      for (const [ret, items] of perRetailer) {
        const sub = items.reduce((a, x) => a + x.price, 0);
        const anyFree = items.some((x) => x.freeShipping);
        const f = feeFor(ret, sub, anyFree);
        const c = couponFor(items, sub);
        goods += sub;
        coupon += c.amount;
        if (f.fee == null) unknown = true;
        else ship += f.fee;
        breakdown.push({
          retailer: ret,
          count: items.length,
          subtotal: sub,
          fee: f.fee,
          unknown: f.unknown,
          why: f.why,
          coupon: c.amount,
          couponWhy: c.why,
        });
      }
      const sum = goods + ship; // 쿠폰은 자동 적용이 아니라 총액에서 빼지 않는다
      if (!best || sum < best.sum || (sum === best.sum && perRetailer.size < best.breakdown.length)) {
        best = { sum, goods, ship, coupon, unknown, breakdown, chosen };
      }
    }
  };

  // 판매처 부분집합 전체를 훑는다
  for (let mask = 1; mask < 1 << retailers.length; mask++) {
    evaluate(retailers.filter((_, i) => mask & (1 << i)));
  }

  // 비교군: 한 판매처에서 몰아서 살 때 (전 버전을 못 갖춘 곳도 커버리지와 함께 보여준다)
  const singles = [];
  for (const ret of new Set(usable.map((r) => r.retailer))) {
    const items = keys
      .map((k) => byKey.get(k).filter((x) => x.retailer === ret).sort((a, b) => a.price - b.price)[0])
      .filter(Boolean);
    if (items.length === 0) continue;
    const sub = items.reduce((a, x) => a + x.price, 0);
    const f = feeFor(ret, sub, items.some((x) => x.freeShipping));
    const c = couponFor(items, sub);
    singles.push({
      retailer: ret,
      goods: sub,
      fee: f.fee,
      coupon: c.amount,
      couponWhy: c.why,
      sum: sub + (f.fee || 0),
      unknown: f.unknown || f.fee == null,
      count: items.length,
      full: items.length === keys.length,
    });
  }
  singles.sort((a, b) => b.count - a.count || a.sum - b.sum);

  const anyFull = singles.some((s) => s.full);

  // 실제로 더 흔한 경우: "이 버전 하나만 살 건데 어디가 최저 총액인가"
  // 소액이면 배송비가 총액을 가른다 (3만원 미만이면 Ktown4u 3,000원 vs 알라딘 무료)
  const perVersion = keys.map((k) => {
    const cands = byKey
      .get(k)
      .map((c) => {
        const f = feeFor(c.retailer, c.price, c.freeShipping);
        const cp = couponFor([c], c.price);
        return { ...c, fee: f.fee, feeWhy: f.why, feeUnknown: f.unknown, coupon: cp.amount, total: c.price + (f.fee || 0) };
      })
      .sort((a, b) => a.total - b.total);
    const spread = cands.length > 1 ? cands[cands.length - 1].total - cands[0].total : 0;
    return { key: k, edition: cands[0]?.edition, packaging: cands[0]?.packaging, cands, spread };
  });
  perVersion.sort((a, b) => b.spread - a.spread);

  return { versions: keys.length, best, singles, anyFull, perVersion, policy: POLICY };
}
