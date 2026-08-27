import { withPage, close } from './src/browser.mjs';

const r = await withPage(
  'https://makestar.co/?keyword=' + encodeURIComponent('태민'),
  async (page) => {
    await page.waitForTimeout(6500);
    return page.evaluate(() => {
      // 이벤트 카드 후보: /event/ 링크를 가진 요소를 위로 거슬러 찾는다
      const out = [];
      const seen = new Set();
      for (const a of document.querySelectorAll('a')) {
        const href = a.getAttribute('href') || '';
        if (!/^\/(event|product)\/\d+/.test(href)) continue;
        let box = a;
        for (let i = 0; i < 5 && box; i++) {
          box = box.parentElement;
          if (box && box.innerText && box.innerText.length > 30 && box.innerText.length < 400) break;
        }
        const txt = (box?.innerText || a.innerText || '').replace(/\s+/g, ' ').trim();
        if (!txt || seen.has(href)) continue;
        seen.add(href);
        out.push({ href, txt: txt.slice(0, 220) });
      }
      return { anchors: out.slice(0, 14), classes: [...new Set([...document.querySelectorAll('div[class]')].map((d) => d.className))].filter((c) => /event|card|item|list/i.test(c)).slice(0, 12) };
    });
  },
  { settle: 500, timeout: 40000 }
);

console.log('=== 메이크스타 검색 카드 ===');
(r?.anchors || []).forEach((x) => console.log(' ', x.href.padEnd(18), '|', x.txt.slice(0, 130)));
console.log('\n클래스 후보:', (r?.classes || []).slice(0, 8).join(' / '));
await close();
