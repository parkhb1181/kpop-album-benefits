/**
 * 헤드리스 브라우저 — 정적 fetch로 안 열리는 판매처용.
 *
 * 정적으로 되는 곳(위버스샵·알라딘·Ktown4u·사운드웨이브)에는 절대 쓰지 않는다.
 * 느리고 비싸다. 아래 셋만 이걸 거친다:
 *   YES24(검색결과 JS 렌더) · 메이크스타(HTTP 429 봇차단) · 위드뮤(SPA 셸)
 *
 * playwright가 없으면 조용히 비활성화된다 — 정적 경로는 그대로 돈다.
 */

let _pw = null;
let _browser = null;
let _ctx = null;
let _disabled = false;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

export function isDisabled() {
  return _disabled;
}

async function ensure() {
  if (_disabled) return null;
  if (_ctx) return _ctx;
  try {
    _pw = await import('playwright');
  } catch {
    _disabled = true;
    return null;
  }
  try {
    _browser = await _pw.chromium.launch({ headless: true });
    _ctx = await _browser.newContext({
      userAgent: UA,
      locale: 'ko-KR',
      viewport: { width: 1400, height: 1000 },
      extraHTTPHeaders: { 'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8' },
    });
    // 이미지·폰트·미디어는 안 받는다 — 우리는 DOM만 필요하다
    await _ctx.route('**/*', (route) => {
      const t = route.request().resourceType();
      if (t === 'image' || t === 'font' || t === 'media') return route.abort();
      return route.continue();
    });
    return _ctx;
  } catch (e) {
    _disabled = true;
    return null;
  }
}

/**
 * 페이지를 열고 콜백에 넘긴다.
 * @param {string} url
 * @param {(page: any) => Promise<any>} fn
 * @param {{waitFor?: string, timeout?: number, settle?: number}} [opt]
 */
export async function withPage(url, fn, opt = {}) {
  const ctx = await ensure();
  if (!ctx) return null;
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opt.timeout ?? 25000 });
    if (opt.waitFor) {
      await page.waitForSelector(opt.waitFor, { timeout: opt.timeout ?? 15000 }).catch(() => {});
    }
    if (opt.settle) await page.waitForTimeout(opt.settle);
    return await fn(page);
  } catch {
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

/** 렌더된 HTML을 그대로 가져온다 (기존 정규식 파서를 재사용할 때 편하다) */
export async function renderedHtml(url, opt = {}) {
  return withPage(url, (page) => page.content(), opt);
}

export async function close() {
  try {
    await _ctx?.close();
    await _browser?.close();
  } catch {}
  _ctx = null;
  _browser = null;
}
