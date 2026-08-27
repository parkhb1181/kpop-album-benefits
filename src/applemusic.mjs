import { getText, strip, parseTitle } from './fetchx.mjs';

/**
 * 애플뮤직(applemusic.co.kr) — 국내 음반몰. 애플의 그 애플뮤직이 아니다.
 * 메이크샵 기반이라 정적 HTML로 검색이 열린다.
 *
 * 여기만 주는 것 — **`subname`에 구성품이 통째로 적혀 있다.**
 *   "[페트 케이스+미니 쥬얼케이스+커버+NFC 디스크+셀피 포토카드]"
 * 다른 몰은 상세를 열어야 나오는 정보다.
 */

const BASE = 'https://www.applemusic.co.kr';

export async function search(query) {
  const html = await getText(`${BASE}/shop/shopbrand.html?search=${encodeURIComponent(query)}`);

  const out = [];
  const seen = new Set();

  for (const block of html.split(/<dl class="item-list">/)) {
    const uid = (block.match(/shopdetail\.html\?branduid=(\d+)/) || [])[1];
    if (!uid || seen.has(uid)) continue;

    const title = strip((block.match(/<div class="dsc">\s*<div[^>]*>([\s\S]{0,300}?)<\/div>/) || [])[1]);
    if (!title) continue;

    // consumer가 정가, price가 실제 판매가다. 순서를 뒤집으면 이 몰만 비싸 보인다.
    const price = (block.match(/<div class="price">\s*<span>\s*([\d,]+)\s*<\/span>/) || [])[1];
    if (!price) continue;
    const listPrice = (block.match(/<div class="consumer">\s*([\d,]+)\s*원/) || [])[1];

    // 구성품 — 이 몰의 고유 자산이다
    const composition = strip((block.match(/<div class="subname">([\s\S]{0,400}?)<\/div>/) || [])[1]) || null;

    seen.add(uid);
    out.push({
      retailer: '애플뮤직',
      id: uid,
      title,
      ...parseTitle(title),
      currency: 'KRW',
      price: Number(price.replace(/,/g, '')),
      listPrice: listPrice ? Number(listPrice.replace(/,/g, '')) : null,
      sales: null,
      releaseDate: null,
      url: `${BASE}/shop/shopdetail.html?branduid=${uid}`,
      benefit: [],
      // 상품명에 특전 표식을 단다: [애플특전]
      // 상세를 열어봤자 특전 문구가 안 나온다(실측 0/4). 그래서 상품명만 본다.
      benefitFlag: /특전/.test(title),
      benefitStatus: /특전/.test(title) ? 'listed' : 'unknown',
      composition,
      // 여기 품절 표시는 진짜 신호다 — 21개 블록 중 1개에만 붙어 있다.
      // (뮤직플랜트는 모든 블록에 붙어 있어서 못 쓴다)
      soldOut: /품절|sold\s*out/i.test(strip(block)),
      thumb: (block.match(/<img[^>]+src="(\/shopimages\/[^"]+)"/) || [])[1]
        ? `${BASE}${(block.match(/<img[^>]+src="(\/shopimages\/[^"]+)"/) || [])[1]}`
        : null,
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
 * 화면에 **"특전 없음"** 이라고 단정해서 나온다. 상품명이 [애플특전]인데도 그랬다.
 * 지금은 상품명의 특전 표식만 보고 'listed'(특전 있음 · 상품명에만 표기)로 둔다.
 */
