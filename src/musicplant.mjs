import { getText, strip, parseTitle } from './fetchx.mjs';

/**
 * 뮤직플랜트 — 위사몰. 정적 HTML로 검색이 그대로 열린다.
 *
 * 검색어 파라미터는 `search_str`이다. `search`로 넣으면 200이 오지만 결과가 비어 있어
 * "열리는 것처럼" 보인다. 예스24에서 같은 함정에 걸렸었다 —
 * **쿼리를 바꿔도 결과가 안 변하면 그건 검색이 아니다.** (실측: 쿼리별로 응답이 달라진다)
 */

const BASE = 'https://www.musicplant.co.kr';

export async function search(query) {
  const html = await getText(`${BASE}/shop/search_result.php?search_str=${encodeURIComponent(query)}`);

  const out = [];
  const seen = new Set();

  for (const block of html.split(/<li>/)) {
    const pno = (block.match(/detail\.php\?pno=([A-Za-z0-9]+)/) || [])[1];
    if (!pno || seen.has(pno)) continue;

    const title = strip((block.match(/<p class="name">([\s\S]{0,500}?)<\/p>/) || [])[1]);
    if (!title) continue;

    // 금액이 셋 나온다: discount(할인가) · sell(판매가) · consumer(정가).
    // consumer를 집으면 이 몰만 비싸 보인다 — 위드뮤에서 실제로 그렇게 틀렸었다.
    const price =
      (block.match(/class="discount[^"]*"[^>]*>\s*<strong>\s*([\d,]+)\s*원/) || [])[1] ||
      (block.match(/class="sell[^"]*"[^>]*>\s*<strong>\s*([\d,]+)\s*원/) || [])[1];
    if (!price) continue;
    const listPrice = (block.match(/class="consumer[^"]*"[^>]*>\s*([\d,]+)\s*원/) || [])[1];

    seen.add(pno);
    out.push({
      retailer: '뮤직플랜트',
      id: pno,
      title,
      ...parseTitle(title),
      currency: 'KRW',
      price: Number(price.replace(/,/g, '')),
      listPrice: listPrice ? Number(listPrice.replace(/,/g, '')) : null,
      sales: null,
      releaseDate: null,
      url: `${BASE}/shop/detail.php?pno=${pno}`,
      benefit: [],
      benefitFlag: false,
      // 목록에서는 특전 문구를 안 준다. 상세를 열어야 한다 (detail 참고).
      benefitStatus: 'unknown',
      // 재고는 모른다고 둔다. `<div class="soldout">Sold out</div>`가 **모든 상품 블록에**
      // 들어 있다 (실측 20/20) — CSS로 숨기는 템플릿이라 정보가 아니다.
      // 이걸 그대로 읽으면 이 몰 상품 전부를 품절이라고 거짓말하게 된다.
      soldOut: null,
      thumb: (block.match(/<img src="(https:\/\/musicplantcorp[^"]+)"/) || [])[1] || null,
    });
  }
  return out;
}

/** 상세 — 예약 특전 문구가 상품 설명에 있다 */
export async function detail(pno) {
  const html = await getText(`${BASE}/shop/detail.php?pno=${encodeURIComponent(pno)}`);
  const flat = strip(html);

  const benefit = [];
  for (const re of [
    /예약\s*판매\s*특전[^.]{0,140}/g,
    /뮤직플랜트\s*특전[^.]{0,140}/g,
    /특전\s*[:：][^.]{0,120}/g,
    /미공개\s*포토카드[^.]{0,110}/g,
  ]) {
    for (const m of flat.matchAll(re)) benefit.push(m[0].trim());
  }

  // 긴 것부터 남기고 그 안에 포함되는 짧은 중복은 버린다
  const uniq = [...new Set(benefit)].sort((a, b) => b.length - a.length);
  const kept = [];
  for (const b of uniq) if (!kept.some((k) => k.includes(b))) kept.push(b);

  const ended = /증정\s*종료|특전\s*종료|소진/.test(flat) && kept.length === 0;
  return { benefit: kept.slice(0, 2), status: kept.length ? 'has' : ended ? 'ended' : 'none' };
}
