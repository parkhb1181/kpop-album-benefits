// 3개 판매처가 순수 fetch로 뚫리는지 확인하는 탐침
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

const targets = [
  {
    name: 'weverse-sale-detail',
    url: 'https://shop.weverse.io/ko/shop/KRW/artists/10/sales/66737',
    check: (t) => {
      const m = t.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (!m) return { ok: false, why: 'no __NEXT_DATA__' };
      const d = JSON.parse(m[1]);
      const qs = d?.props?.pageProps?.$dehydratedState?.queries || [];
      const sale = qs.find((q) => String(q.queryKey?.[0]).includes('/sales/:saleId'));
      const s = sale?.state?.data;
      return {
        ok: !!s,
        name: s?.name,
        icons: s?.icons,
        eventGuides: s?.eventGuides,
        detailImages: (s?.detailImages || []).length,
      };
    },
  },
  {
    name: 'aladin-search',
    url: 'https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=Music&SearchWord=' + encodeURIComponent('엔하이픈 THE SIN'),
    check: (t) => {
      const hits = [...t.matchAll(/wproduct\.aspx\?ItemId=(\d+)/g)].map((m) => m[1]);
      const titles = [...t.matchAll(/<a[^>]+class="bo3"[^>]*>([\s\S]{0,200}?)<\/a>/g)].map((m) =>
        m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      );
      return { ok: hits.length > 0, itemIds: [...new Set(hits)].slice(0, 5), titles: titles.slice(0, 5) };
    },
  },
  {
    name: 'ktown4u-search',
    url: 'https://www.ktown4u.com/searchList?goodsTextSearch=' + encodeURIComponent('ENHYPEN THE SIN'),
    check: (t) => {
      const goods = [...t.matchAll(/goods_no=(\d+)/g)].map((m) => m[1]);
      const hasNext = /__NEXT_DATA__|__NUXT__|window\.__/.test(t);
      return { ok: goods.length > 0, goodsNos: [...new Set(goods)].slice(0, 5), len: t.length, hasSPAState: hasNext };
    },
  },
];

for (const t of targets) {
  try {
    const res = await fetch(t.url, {
      headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8' },
      redirect: 'follow',
    });
    const text = await res.text();
    let result;
    try {
      result = t.check(text);
    } catch (e) {
      result = { ok: false, why: 'parse error: ' + e.message };
    }
    console.log(`\n=== ${t.name} === HTTP ${res.status} (${text.length} bytes)`);
    console.log(JSON.stringify(result, null, 2).slice(0, 1200));
  } catch (e) {
    console.log(`\n=== ${t.name} === FETCH FAILED: ${e.message}`);
  }
}
