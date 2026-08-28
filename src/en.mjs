/**
 * 영어판 렌더 — `/en/`.
 *
 * **번역이 아니라 변형이다.** 영어권 팬은 특전을 **POB**(pre-order benefit)라 부르고,
 * 자동완성 실측에서 `kpop pob` 10건 · `kpop pob stores` 4건이 잡힌다.
 * 반대로 `kpop pob comparison`·`kpop album pob list`는 0건이라 **롱테일이 비어 있다.**
 * 그래서 `benefit`이 아니라 `POB`로 쓴다 — 용어 하나가 검색 유입 전부를 가른다.
 *
 * 이 파일을 render.mjs와 합치지 않은 이유는 두 가지다.
 *  ① render.mjs는 지금 다른 작업이 계속 들어가는 파일이라 로케일 분기를 심으면 충돌한다.
 *  ② 영어판은 국내판과 **정보 축이 달라질 예정**이다(국제배송 가능 여부·한터 인증).
 *     지금은 같은 스냅샷을 쓰지만, 갈라질 자리를 미리 분리해 둔다.
 *
 * 데이터는 국내판과 **같은 `out/data/{slug}.json`** 을 쓴다. 스크레이퍼도 빌드도 하나다.
 */
import { esc } from './render.mjs';
import { abs, metaTags } from './seo.mjs';

export const BRAND_EN = 'Albumnote';
const TAGLINE_EN = 'K-pop album POBs by store';

const CSS = `*{box-sizing:border-box}
:root{--bg:#fff;--fg:#1a1a1a;--mut:#757575;--dim:#a0a0a0;--line:#e4e4e4;--acc:#c2410c;--card:#f4f4f4}
body{margin:0 auto;padding:24px 24px 72px;max-width:880px;background:var(--bg);color:var(--fg);
font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
a{color:inherit}
.hd{padding-bottom:8px;border-bottom:2px solid var(--fg);margin-bottom:24px}
.brand{display:flex;align-items:baseline;gap:8px;margin:0;flex-wrap:wrap}
.brand .lg{align-self:center;flex:0 0 auto}
.bd{font-size:20px;font-weight:800;letter-spacing:-.02em;white-space:nowrap}
.tl{font-size:14px;color:var(--mut)}
h1{font-size:26px;line-height:1.25;margin:0 0 6px}
h1 .alb{color:var(--mut);font-weight:600}
.sum{font-size:14px;color:var(--mut);margin:0 0 20px}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;color:var(--mut);font-weight:600;white-space:nowrap}
td.n{white-space:nowrap}
.pob{color:var(--fg)}
.no{color:var(--dim)}
.hid{color:var(--acc);font-weight:600}
.gone{text-decoration:line-through;color:var(--dim)}
.card{border:1px solid var(--line);border-radius:8px;padding:14px 16px;margin-bottom:10px}
.card a{font-weight:700;text-decoration:none}
.card .m{font-size:13px;color:var(--mut);margin-top:4px}
.ft{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);font-size:13px;color:var(--mut)}
.back{display:inline-block;font-size:13px;color:var(--mut);margin-bottom:14px;text-decoration:none}`;

/** 마크는 국내판과 같은 도형을 쓴다 — 같은 브랜드다 */
const MARK =
  '<g fill="none" stroke="currentColor">' +
  '<circle cx="10" cy="10" r="8.6" stroke-width="2"/>' +
  '<circle cx="10" cy="10" r="6" stroke-width="2"/>' +
  '<circle cx="10" cy="10" r="3.5" stroke-width="1.8"/>' +
  '</g><circle cx="10" cy="10" r="1" fill="currentColor"/>';

const header = (href) => `<header class="hd"><${href ? `a class="brand" href="${esc(href)}"` : 'h1 class="brand"'}>
<svg class="lg" width="24" height="24" viewBox="0 0 20 20" aria-hidden="true">${MARK}</svg>
<span class="bd">${BRAND_EN}</span><span class="tl">${TAGLINE_EN}</span>
</${href ? 'a' : 'h1'}></header>`;

const shell = (title, body, meta) => {
  const { jsonLd, ...rest } = meta;
  const ld = jsonLd ? `\n<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
${metaTags({ title, locale: 'en_US', ...rest })}${ld}
<style>${CSS}</style></head><body>${body}</body></html>`;
};

const won = (n) => (n == null ? '—' : `₩${n.toLocaleString()}`);

/**
 * 판매처 이름 — 영어권이 실제로 부르는 이름으로 바꾼다.
 *
 * 한글 상호를 그대로 두면 `kpop pob stores`로 들어온 사람이 어느 샵인지 못 알아본다.
 * 영어권 팬덤은 Aladin·Weverse Shop·Soundwave·Ktown4u로 부르고, 그게 GO 공지에도
 * 그대로 쓰인다. 표기를 맞춰야 GO 매니저가 우리 표를 그대로 인용할 수 있다.
 */
const STORE_EN = {
  알라딘: 'Aladin',
  위버스샵: 'Weverse Shop',
  사운드웨이브: 'Soundwave',
  뮤직플랜트: 'Music Plant',
  위드뮤: 'Withmuu',
  애플뮤직: 'Applemusic (KR)',
  메이크스타: 'Makestar',
};
const storeEn = (k) => STORE_EN[k] || k;

/**
 * POB 문구에서 판매처 접두어를 뗀다.
 * 원문이 "알라딘 특전: 미공개 포토카드…"인데 표에 이미 Store 열이 있어 같은 말이 두 번 나온다.
 * 본문은 판매처가 쓴 한국어 그대로 둔다 — 임의로 옮기면 틀린 정보를 만든다.
 */
const cleanPob = (b) =>
  String(b)
    .replace(/^\s*(?:케타포|[가-힣A-Za-z0-9]+)\s*특전\s*[:：]?\s*/, '')
    .trim();

/**
 * 특전 상태를 영어로 옮긴다.
 * `secret`(구성 비공개)과 `unknown`(우리가 확인 못함)을 절대 합치지 않는다 —
 * "판매처가 안 밝힘"과 "우리가 모름"은 정반대 정보다. 국내판이 지키는 구분과 같다.
 */
function pobCell(r) {
  if (r.benefit?.length) return `<span class="pob">${esc(r.benefit.map(cleanPob).join(' · '))}</span>`;
  if (r.benefitStatus === 'secret') return '<span class="hid">Yes — contents not revealed</span>';
  if (r.benefitStatus === 'listed') return '<span class="hid">Yes — title only</span>';
  if (r.benefitStatus === 'ended') return '<span class="no">Ended</span>';
  if (r.benefitStatus === 'none') return '<span class="no">None listed</span>';
  return '<span class="no">Not checked</span>';
}

/** 판매처 하나로 묶는다 — 영어권이 찾는 건 "which store gives what"이다 */
function byStore(rows) {
  const m = new Map();
  for (const r of rows) {
    const k = r.retailer;
    if (!m.has(k)) m.set(k, { retailer: k, rows: [], prices: [], pob: new Set(), status: new Set() });
    const g = m.get(k);
    g.rows.push(r);
    if (!r.soldOut && r.price && r.currency === 'KRW') g.prices.push(r.price);
    for (const b of r.benefit || []) g.pob.add(b);
    g.status.add(r.benefitStatus || 'unknown');
  }
  return [...m.values()].sort((a, b) => b.pob.size - a.pob.size || b.rows.length - a.rows.length);
}

export function renderEnAlbum({ slug, target, rows, stamp, siteUrl, ogCard, shortDate }) {
  const artist = target.artistEn || target.artist;
  const album = target.album;
  const stores = byStore(rows);
  const live = rows.filter((r) => !r.soldOut);
  const prices = live.filter((r) => r.price && r.currency === 'KRW').map((r) => r.price);
  const versions = new Set(rows.map((r) => r.key || r.editionKey)).size;
  const withPob = stores.filter((s) => s.pob.size).length;

  const enUrl = abs(siteUrl, `en/album/${slug}`);
  const koUrl = abs(siteUrl, `album/${slug}`);

  const table = `<table><thead><tr>
<th>Store</th><th>Versions</th><th>From</th><th>Pre-order benefit (POB)</th>
</tr></thead><tbody>
${stores
    .map((s) => {
      const soldAll = s.rows.every((r) => r.soldOut);
      const link = s.rows.find((r) => r.url)?.url;
      const name = link ? `<a href="${esc(link)}" rel="nofollow noopener" target="_blank">${esc(storeEn(s.retailer))}</a>` : esc(storeEn(s.retailer));
      const pob = s.pob.size
        ? `<span class="pob">${esc([...s.pob].map(cleanPob).join(' · '))}</span>`
        : pobCell(s.rows[0]);
      return `<tr><td${soldAll ? ' class="gone"' : ''}>${name}</td>
<td class="n">${s.rows.length}</td>
<td class="n">${s.prices.length ? won(Math.min(...s.prices)) : '<span class="no">sold out</span>'}</td>
<td>${pob}</td></tr>`;
    })
    .join('\n')}
</tbody></table>`;

  const body = `${header('../')}
<a class="back" href="../">← All comebacks</a>
<h1>${esc(artist)} <span class="alb">${esc(album)}</span></h1>
<p class="sum">${versions} versions across ${stores.length} stores${prices.length ? ` · from ${won(Math.min(...prices))}` : ''}${
    withPob ? ` · ${withPob} store${withPob > 1 ? 's' : ''} with a listed POB` : ''
  }${target.deliveryDate ? ` · releases ${esc(target.deliveryDate)}` : ''}</p>
${table}
<p class="ft">Prices are Korean store prices before international shipping. Many Korean stores need a
Korean address or a forwarding service — check the store page before ordering.<br>
POB text is quoted as written by each store, in Korean.<br>
Collected automatically from the stores listed above · Updated ${esc(shortDate || '')} ·
<a href="${esc(koUrl || '../../')}">한국어</a></p>`;

  return shell(`${artist} ${album} POB by Store | ${BRAND_EN}`, body, {
    description:
      `Which store gives which pre-order benefit (POB) for ${artist} — ${album}. ` +
      `${versions} versions compared across ${stores.length} Korean stores. Updated ${shortDate || ''}.`.slice(0, 160),
    canonical: enUrl,
    image: ogCard || undefined,
    type: 'article',
    alternates: [
      { lang: 'ko', href: koUrl },
      { lang: 'en', href: enUrl },
    ],
  });
}

export function renderEnIndex({ albums, stamp, siteUrl, shortDate }) {
  const live = albums.filter((a) => !a.expired);
  const enUrl = abs(siteUrl, 'en/');
  const koUrl = abs(siteUrl, '');

  const list = live
    .map(
      (a) => `<div class="card">
<a href="album/${esc(a.slug)}">${esc(a.artistEn || a.artist)} — ${esc(a.album)}</a>
<div class="m">${a.versions || a.skuCount || '?'} versions · ${a.retailers || '?'} stores${
        a.benefitCount ? ` · ${a.benefitCount} with POB` : ''
      }</div></div>`
    )
    .join('\n');

  const body = `${header(null)}
<p class="sum">Pre-order benefits (POB) for K-pop albums, compared store by store.
Collected automatically twice a day from Korean stores.</p>
${list}
<p class="ft">Prices are Korean store prices before international shipping ·
Updated ${esc(shortDate || '')} · <a href="${esc(koUrl || '../')}">한국어</a></p>`;

  return shell(`K-pop Album POB Comparison by Store | ${BRAND_EN}`, body, {
    description:
      `Which Korean store gives which pre-order benefit (POB) for ${live.length} K-pop albums on pre-order. ` +
      `Versions, prices and POBs compared. Updated ${shortDate || ''}.`.slice(0, 160),
    canonical: enUrl,
    image: albums.find((a) => a.ogCard)?.ogCard || undefined,
    alternates: [
      { lang: 'ko', href: koUrl },
      { lang: 'en', href: enUrl },
    ],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${abs(siteUrl, '') || ''}#website`,
      name: BRAND_EN,
      alternateName: '앨범노트',
      description: TAGLINE_EN,
      url: abs(siteUrl, '') || undefined,
      inLanguage: ['ko-KR', 'en-US'],
      sameAs: ['https://x.com/albumnote_'],
    },
  });
}
