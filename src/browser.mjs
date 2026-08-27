/**
 * 헤드리스 브라우저 — 정적 fetch로 안 열리는 판매처용.
 *
 * 정적으로 되는 곳(위버스샵·알라딘·Ktown4u·사운드웨이브)에는 절대 쓰지 않는다.
 * 느리고 비싸다. 지금 이걸 거치는 곳은 둘뿐이다:
 *   위드뮤(SPA 셸) · YES24(검색결과 JS 렌더)
 *
 * 메이크스타도 여기 있었는데 뺐다. HTML은 여전히 429로 막히지만
 * Nuxt 앱이 쓰는 커머스 API가 열려 있어서 평범한 fetch로 더 정확하게 얻는다.
 * → src/makestar.mjs
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
 * 정해진 시간 안에 안 끝나면 포기한다.
 *
 * goto와 waitForSelector에는 한도가 있지만 `page.evaluate`에는 없다. 위드뮤는 SPA라
 * 렌더러가 물리면 evaluate가 영원히 안 돌아오고, 그러면 빌드 전체가 선다.
 * 실제로 20분 작업 한도에 걸려 두 번 죽었다 — 그때 로그에는 앨범 한 줄도 안 찍혔다.
 * page.close()도 라우트 가로채기가 걸린 채로는 안 돌아올 수 있어 같이 막는다.
 */
const bounded = (promise, ms, fallback) =>
  Promise.race([promise, new Promise((res) => setTimeout(() => res(fallback), ms))]);

/**
 * 페이지를 열고 콜백에 넘긴다.
 * @param {string} url
 * @param {(page: any) => Promise<any>} fn
 * @param {{waitFor?: string, timeout?: number, settle?: number, hard?: number}} [opt]
 */

export async function withPage(url, fn, opt = {}) {
  const ctx = await ensure();
  if (!ctx) return null;
  const page = await bounded(ctx.newPage(), 15000, null);
  if (!page) return null;
  const HANG = Symbol('hang');
  try {
    const work = (async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opt.timeout ?? 25000 });
      if (opt.waitFor) {
        await page.waitForSelector(opt.waitFor, { timeout: opt.timeout ?? 15000 }).catch(() => {});
      }
      if (opt.settle) await page.waitForTimeout(opt.settle);
      return await fn(page);
    })();
    // 안쪽 한도의 합보다 넉넉하게 — 여기 걸리면 정상 지연이 아니라 멈춘 것이다
    const out = await bounded(work, opt.hard ?? 60000, HANG);
    return out === HANG ? null : out;
  } catch {
    return null;
  } finally {
    // 닫기가 안 돌아와도 기다리지 않는다. 새는 페이지 하나가 빌드를 세우는 것보다 낫다.
    await bounded(page.close().catch(() => {}), 5000, null);
  }
}

/** 렌더된 HTML을 그대로 가져온다 (기존 정규식 파서를 재사용할 때 편하다) */
export async function renderedHtml(url, opt = {}) {
  return withPage(url, (page) => page.content(), opt);
}

export async function close() {
  try {
    await bounded(_ctx?.close(), 5000, null);
    await bounded(_browser?.close(), 5000, null);
  } catch {}
  _ctx = null;
  _browser = null;
}
