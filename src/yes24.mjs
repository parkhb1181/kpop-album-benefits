import { getText, strip, parseTitle } from './fetchx.mjs';

const BASE = 'https://www.yes24.com';

/** YES24는 EUC-KR이라 getText에 인코딩을 넘겨야 한다 */
export async function search(query) {
  const html = await getText(`${BASE}/product/search?domain=MUSIC&query=${encodeURIComponent(query)}`, {
    encoding: 'euc-kr',
  });

  const out = [];
  const seen = new Set();

  // 구조: <li> … <a href="/Product/Goods/{id}"> … <p class="goods_name">제목</p> … <em class="yes_b">가격</em>원
  for (const block of html.split('<li>')) {
    const id = (block.match(/\/Product\/Goods\/(\d+)/) || [])[1];
    if (!id || seen.has(id)) continue;
    const title =
      strip((block.match(/class="goods_name"[\s\S]{0,200}?<a[^>]*>([\s\S]{0,220}?)<\/a>/) || [])[1]) ||
      strip((block.match(/<img[^>]*alt="([^"]{5,220})"/) || [])[1]);
    if (!title) continue;
    const price = (block.match(/class="yes_b"[^>]*>([\d,]+)<\/em>/) || [])[1];
    if (!price) continue;
    seen.add(id);

    const flat = strip(block);
    const benefit = [];
    for (const re of [/예약\s*판매\s*특전[^.]{0,120}/g, /예약특전[^.]{0,120}/g, /초도[^.]{0,120}/g]) {
      for (const m of flat.matchAll(re)) benefit.push(m[0].trim());
    }

    out.push({
      retailer: 'YES24',
      id,
      title,
      ...parseTitle(title),
      currency: 'KRW',
      price: Number(price.replace(/,/g, '')),
      sales: null,
      releaseDate: null,
      url: `${BASE}/Product/Goods/${id}`,
      benefit: [...new Set(benefit)].slice(0, 3),
      benefitFlag: benefit.length > 0,
    });
  }
  return out;
}
