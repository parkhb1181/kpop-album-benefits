// 일회성 확인용 — 러너 IP에서 로그아웃 x.com 프로필이 렌더되는지.
// 3차 프로브에서 article 0건이 나왔는데, 그게 차단인지 렌더 타이밍인지 가른다.
// 확인 후 이 파일과 .github/workflows/probe-x.yml을 함께 지운다.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  locale: 'ko-KR',
  extraHTTPHeaders: { 'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8' },
});

for (const handle of ['musicplant_kr', 'Withmuu_twt']) {
  const page = await ctx.newPage();
  try {
    const resp = await page.goto('https://x.com/' + handle, {
      waitUntil: 'domcontentloaded',
      timeout: 40000,
    });
    console.log(handle + ' → HTTP ' + (resp && resp.status()));

    await page
      .waitForSelector('article', { timeout: 25000 })
      .catch(() => console.log('   article 대기 실패 (25초)'));
    await page.waitForTimeout(8000);

    const r = await page.evaluate(() => ({
      title: document.title,
      bodyLen: document.body.innerText.length,
      arts: document.querySelectorAll('article').length,
      head: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
    }));
    console.log('   title=' + r.title + ' · body=' + r.bodyLen + ' · article=' + r.arts);
    console.log('   본문: ' + r.head);
  } catch (e) {
    console.log(handle + ' → 실패 ' + e.message.slice(0, 120));
  }
  await page.close();
}

await browser.close();
