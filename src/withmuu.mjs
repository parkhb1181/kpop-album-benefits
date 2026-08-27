import { strip, parseTitle } from './fetchx.mjs';
import { withPage } from './browser.mjs';

const BASE = 'https://www.withmuu.com';

/**
 * 위드뮤 — 정적 fetch로는 8KB 셸만 온다. 헤드리스가 필요하다.
 * playwright가 없으면 빈 배열을 돌려주고 조용히 빠진다.
 */
/**
 * 위드뮤 검색은 공백이 들어간 복합 질의를 못 받는다.
 *   "태민" → 20건 · "Soft Violence" → 6건 · "태민 Soft Violence" → 0건
 * 그래서 원문으로 한 번 시도하고, 0건이면 토큰을 하나씩 넣어본다.
 */
export async function search(query) {
  const tries = [query];
  if (/\s/.test(query)) {
    const toks = query
      .split(/[\s:·\-&+()[\]]+/)
      .filter((w) => w.length >= 2 && !/^(the|and|album|mini|vol|ver|part|st|nd|rd|th|\d+)$/i.test(w))
      .sort((a, b) => b.length - a.length);
    tries.push(...toks.slice(0, 3));
  }
  for (const q of tries) {
    const r = await searchOnce(q);
    if (r.length) return r;
  }
  return [];
}

async function searchOnce(query) {
  const url = `${BASE}/goods/goods_search.php?keyword=${encodeURIComponent(query)}`;
  const raw = await withPage(
    url,
    (page) =>
      page.evaluate(() => {
        const out = [];
        const seen = new Set();
        for (const a of document.querySelectorAll('a')) {
          const id = (a.href.match(/goodsNo=(\d+)/) || [])[1];
          if (!id || seen.has(id)) continue;
          let box = a;
          for (let i = 0; i < 6 && box; i++) {
            box = box.parentElement;
            if (box && /원/.test(box.innerText) && box.innerText.length < 500) break;
          }
          const txt = (box?.innerText || '').replace(/\s+/g, ' ').trim();
          const alt = a.querySelector('img')?.getAttribute('alt') || '';
          const title = (alt || txt).trim();
          const price = (txt.match(/([\d,]{4,})\s*원/) || [])[1];
          if (!title || !price) continue;
          seen.add(id);
          out.push({
            id,
            title,
            price,
            soldOut: /품절|SOLD\s*OUT|일시품절/i.test(txt),
            thumb: a.querySelector('img')?.src || null,
          });
        }
        return out;
      }),
    { settle: 2500 }
  );
  if (!raw) return [];

  return raw.map((x) => {
    const title = strip(x.title);
    return {
      retailer: '위드뮤',
      id: x.id,
      title,
      ...parseTitle(title),
      currency: 'KRW',
      price: Number(String(x.price).replace(/,/g, '')),
      sales: null,
      releaseDate: null,
      url: `${BASE}/goods/goods_view.php?goodsNo=${x.id}`,
      benefit: [],
      benefitFlag: false,
      benefitStatus: 'unknown',
      soldOut: x.soldOut,
      thumb: x.thumb,
    };
  });
}

/** 상세 — 특전 안내가 상품 설명에 있다 */
export async function detail(goodsNo) {
  const html = await withPage(
    `${BASE}/goods/goods_view.php?goodsNo=${goodsNo}`,
    (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')),
    { settle: 3500 }
  );
  if (!html) return { benefit: [], status: 'unknown' };

  const benefit = [];
  for (const re of [
    /예약\s*판매\s*특전[^.]{0,140}/g,
    /위드뮤\s*특전[^.]{0,140}/g,
    /특전\s*[:：][^.]{0,120}/g,
    /미공개\s*포토카드[^.]{0,110}/g,
  ]) {
    for (const m of html.matchAll(re)) benefit.push(m[0].trim());
  }
  const uniq = [...new Set(benefit)].sort((a, b) => b.length - a.length);
  const kept = [];
  for (const b of uniq) if (!kept.some((k) => k.includes(b))) kept.push(b);
  const ended = /종료|마감/.test(html) && kept.length === 0;
  return { benefit: kept.slice(0, 2), status: kept.length ? 'has' : ended ? 'ended' : 'none' };
}
