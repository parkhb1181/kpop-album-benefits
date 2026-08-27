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
      benefitFlag: false,
      benefitStatus: 'unknown',
      composition,
      soldOut: /품절|sold\s*out/i.test(strip(block)) || null,
      thumb: (block.match(/<img[^>]+src="(\/shopimages\/[^"]+)"/) || [])[1]
        ? `${BASE}${(block.match(/<img[^>]+src="(\/shopimages\/[^"]+)"/) || [])[1]}`
        : null,
    });
  }
  return out;
}

/** 상세 — 예약 특전 문구 */
export async function detail(uid) {
  const html = await getText(`${BASE}/shop/shopdetail.html?branduid=${encodeURIComponent(uid)}`);
  const flat = strip(html);

  const benefit = [];
  for (const re of [
    /예약\s*판매\s*특전[^.]{0,140}/g,
    /애플뮤직\s*특전[^.]{0,140}/g,
    /특전\s*[:：][^.]{0,120}/g,
    /미공개\s*포토카드[^.]{0,110}/g,
  ]) {
    for (const m of flat.matchAll(re)) benefit.push(m[0].trim());
  }

  const uniq = [...new Set(benefit)].sort((a, b) => b.length - a.length);
  const kept = [];
  for (const b of uniq) if (!kept.some((k) => k.includes(b))) kept.push(b);

  const ended = /증정\s*종료|특전\s*종료|소진/.test(flat) && kept.length === 0;
  return { benefit: kept.slice(0, 2), status: kept.length ? 'has' : ended ? 'ended' : 'none' };
}
