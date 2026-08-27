import { withPage, close } from './src/browser.mjs';

const url = 'https://www.withmuu.com/goods/goods_search.php?keyword=' + encodeURIComponent('태민');
const r = await withPage(
  url,
  async (page) => {
    await page.waitForTimeout(4000);
    return page.evaluate(() => {
      const anchors = [...document.querySelectorAll('a')].filter((a) => /goodsNo=|goods_view/.test(a.href));
      const items = [];
      const seen = new Set();
      for (const a of anchors) {
        const id = (a.href.match(/goodsNo=(\d+)/) || [])[1];
        if (!id || seen.has(id)) continue;
        // 상품 카드 컨테이너를 위로 거슬러 찾는다
        let box = a;
        for (let i = 0; i < 6 && box; i++) {
          box = box.parentElement;
          if (box && /원/.test(box.innerText) && box.innerText.length < 500) break;
        }
        const txt = (box?.innerText || a.innerText || '').replace(/\s+/g, ' ').trim();
        const price = (txt.match(/([\d,]{4,})\s*원/) || [])[1];
        const alt = a.querySelector('img')?.getAttribute('alt') || '';
        seen.add(id);
        items.push({ id, price, alt: alt.slice(0, 80), txt: txt.slice(0, 100) });
      }
      return { count: items.length, items: items.slice(0, 10), sampleHtml: document.body.innerHTML.length };
    });
  },
  { settle: 2000 }
);

console.log('=== 위드뮤 (headless) ===');
if (!r) console.log('실패');
else {
  console.log('상품', r.count, '건 / DOM', r.sampleHtml, 'b');
  r.items.forEach((x) => console.log(' ', String(x.price || '-').padStart(8), '|', (x.alt || x.txt).slice(0, 72)));
}
await close();
