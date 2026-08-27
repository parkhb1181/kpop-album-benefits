import { getText, strip, parseTitle } from './fetchx.mjs';

const BASE = 'https://www.sound-wave.co.kr';

/**
 * 사운드웨이브 — 카페24 기반. 검색 결과가 정적 HTML로 나온다.
 * 상품 블록: <div class="xans-record-"> 안에 /product/{slug}/{id}/ 링크와 img alt=상품명
 */
export async function search(query) {
  const html = await getText(`${BASE}/product/search.html?keyword=${encodeURIComponent(query)}`);
  const out = [];
  const seen = new Set();

  for (const block of html.split('class="xans-record-"').slice(1)) {
    const idm = block.match(/\/product\/[^"'\s]*?\/(\d+)\/category/);
    if (!idm) continue;
    const id = idm[1];
    if (seen.has(id)) continue;
    const href = (block.match(/href="(\/product\/[^"']+)"/) || [])[1];
    const title = strip((block.match(/<img[^>]*alt="([^"]{5,220})"/) || [])[1]);
    if (!title || /장바구니|위시|아이콘/.test(title)) continue;

    // 가격: "판매가 : 13,800원" 또는 span 안의 숫자+원
    const flat = strip(block);
    const pm =
      flat.match(/판매가[^0-9]{0,10}([\d,]{4,})\s*원/) ||
      flat.match(/([\d,]{4,})\s*원/);
    if (!pm) continue;
    seen.add(id);

    const benefit = [];
    for (const re of [/예약\s*판매\s*특전[^.]{0,120}/g, /특전[^.]{0,100}증정[^.]{0,40}/g, /미공개[^.]{0,100}/g]) {
      for (const m of flat.matchAll(re)) benefit.push(m[0].trim());
    }

    out.push({
      retailer: '사운드웨이브',
      id,
      title,
      ...parseTitle(title),
      currency: 'KRW',
      price: Number(pm[1].replace(/,/g, '')),
      sales: null,
      releaseDate: null,
      url: href ? `${BASE}${href}` : `${BASE}/product/detail.html?product_no=${id}`,
      benefit: [...new Set(benefit)].slice(0, 2),
      benefitFlag: benefit.length > 0,
      benefitStatus: benefit.length ? 'has' : 'unknown',
      soldOut: /품절|SOLD\s*OUT|재입고/i.test(flat),
      thumb: (block.match(/src="(\/\/[^"']*\/web\/product\/(?:small|medium)\/[^"']+)"/) || [])[1]
        ? 'https:' + block.match(/src="(\/\/[^"']*\/web\/product\/(?:small|medium)\/[^"']+)"/)[1]
        : null,
    });
  }
  return out;
}

/** 상세 — 특전 안내는 상세 설명에 있다 */
export async function detail(url) {
  const html = await getText(url);
  const f = strip(html);
  const benefit = [];
  for (const re of [
    /예약\s*판매\s*특전[^.]{0,150}/g,
    /특전\s*[:：][^.]{0,120}/g,
    /미공개\s*포토카드[^.]{0,100}/g,
  ]) {
    for (const m of f.matchAll(re)) benefit.push(m[0].replace(/\s+/g, ' ').trim());
  }
  const uniq = [...new Set(benefit)].sort((a, b) => b.length - a.length);
  const kept = [];
  for (const b of uniq) if (!kept.some((k) => k.includes(b))) kept.push(b);
  const ended = /종료|마감/.test(f) && kept.length === 0;
  return { benefit: kept.slice(0, 2), status: kept.length ? 'has' : ended ? 'ended' : 'none' };
}
