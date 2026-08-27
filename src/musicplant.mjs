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
      // 상품명에 특전 표식을 단다: [특전증정/세트] · [특전증정/랜덤]
      // 상세를 열어봤자 특전 문구가 안 나온다(실측 0/4). 그래서 상품명만 본다.
      benefitFlag: /특전/.test(title),
      benefitStatus: /특전/.test(title) ? 'listed' : 'unknown',
      // 재고는 모른다고 둔다. `<div class="soldout">Sold out</div>`가 **모든 상품 블록에**
      // 들어 있다 (실측 20/20) — CSS로 숨기는 템플릿이라 정보가 아니다.
      // 이걸 그대로 읽으면 이 몰 상품 전부를 품절이라고 거짓말하게 된다.
      soldOut: null,
      thumb: (block.match(/<img src="(https:\/\/musicplantcorp[^"]+)"/) || [])[1] || null,
    });
  }
  return out;
}

/*
 * 상세(detail)는 두지 않는다.
 *
 * 상품마다 페이지를 한 번씩 더 여는데 특전 문구가 **한 건도** 안 나왔다 (실측 0/4).
 * 앨범 13개 × 상품 6개면 요청 78건, 빌드에 30초 이상이다. 위드뮤에서 같은 값을 치렀었다.
 *
 * 더 나빴던 건 비용이 아니라 거짓말이다 — 못 찾은 걸 status:'none'으로 돌려주면
 * 화면에 **"특전 없음"** 이라고 단정해서 나온다. 상품명이 [특전증정/랜덤]인데도 그랬다.
 * 지금은 상품명의 특전 표식만 보고 'listed'(특전 있음 · 상품명에만 표기)로 둔다.
 */
