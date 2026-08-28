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
import { existsSync } from 'node:fs';
import { esc, MARK } from './render.mjs';
import { abs, metaTags } from './seo.mjs';
import { summarizeBenefit } from './i18n-benefit.mjs';

export const BRAND_EN = 'Albumnote';
const TAGLINE_EN = 'K-pop album POBs by store';

const CSS = `*{box-sizing:border-box}
/* 토큰·규칙은 국내판(render.mjs)에서 옮겨온 것이다. 두 파일이 CSS를 따로 갖고 있어
   한쪽만 고치면 갈라진다 — 국내판을 고칠 때 여기도 같이 봐야 한다. */
:root{--bg:#fff;--fg:#1a1a1a;--mut:#757575;--dim:#8a8a8a;--line:#e4e4e4;--acc:#c2410c;--card:#f4f4f4}
/* 포커스 링을 없애지 않는다 — 키보드로 훑을 때 지금 어디인지 알아야 한다(WCAG 2.4.7). */
:focus-visible{outline:2px solid var(--fg);outline-offset:2px}
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
.back{display:inline-block;font-size:13px;color:var(--mut);margin-bottom:14px;text-decoration:none}
/* 영어 요약 밑에 한국어 원문을 작게 남긴다 — 요약이 틀렸을 때 대조할 수 있어야 하고,
   주 독자인 GOM은 한국 스토어에서 직접 사는 사람들이라 원문을 읽는다. */
.ko{display:block;font-size:12px;color:var(--dim);margin-top:3px;word-break:keep-all}
/* 표 네 칸이 375px에 안 들어간다. 폰에서는 판매처와 가격을 한 줄에 세우고
   POB만 아래 폭을 다 쓴다 — 국내판과 같은 방식이다. */
@media(max-width:640px){
body{padding:16px 12px 56px}
thead{display:none}
table,tbody,tr{display:block;width:auto}
tr{border-bottom:1px solid var(--line);padding:10px 0;display:grid;grid-template-columns:1fr auto;gap:0 10px}
td{border:0;padding:0}
td:nth-child(1){grid-column:1;grid-row:1;font-weight:700}
td:nth-child(2){grid-column:2;grid-row:1;text-align:right;font-size:12px;color:var(--mut)}
td:nth-child(2)::after{content:' versions'}
td:nth-child(3){grid-column:2;grid-row:2;text-align:right;font-weight:600}
td:nth-child(4){grid-column:1/-1;margin-top:4px}
}`;

/**
 * 마크는 **베끼지 않고 국내판에서 가져온다**(render.mjs의 MARK).
 *
 * 두 번 갈라졌다. 처음엔 en.mjs가 선으로 그린 다른 원을 갖고 있으면서 주석에만
 * "같다"고 적혀 있었고, 그걸 고친다면서 이번엔 내가 **파일을 안 읽고 기억으로**
 * LP판(채운 원 + 흰 홈)을 옮겨 적었다. 그 도형은 이미 2시간 반 전에 국내판에서
 * 걷어낸 것이었다 — 26px 이하에서 홈이 회색 덩어리로 뭉개지고 먹지 배경에서
 * 흰 동그라미가 돼서(`0ee4fce`). 영문 헤더가 정확히 24px다.
 *
 * 같은 브랜드에 로고가 두 개면 링크를 건너온 사람이 다른 사이트로 읽는다.
 * import면 갈라질 수가 없다.
 */
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
    /**
     * 스크래퍼가 물고 온 JS 조각을 걷어낸다 —
     *   "urn itemEventSwiper; } 이벤트 이벤트 TXT 미니 8집 …"
     * 실측 79건 중 8건(TXT 알라딘 전부)이 이렇다. 요약기는 이걸 무시하고 품목을
     * 제대로 뽑지만, 원문 줄(.ko)에는 그대로 나간다.
     *
     * "; }"에 기대는 건 **대리 지표가 아니라 문법**이다 — JS 블록 닫기라 특전
     * 설명에 나올 수 없다. 앞은 한글 아닌 것만 40자까지, 뒤는 중복된 "이벤트"까지.
     * 79건에 돌려서 8건을 다 잡고 나머지 71건은 한 글자도 안 건드린다.
     *
     * 표시용 응급처치다. 원인은 수집 쪽이라 docs/38에 10번으로 인계했다.
     */
    .replace(/^[^가-힣\n]{0,40};\s*\}\s*(?:이벤트\s*)*/, '')
    .trim();

/**
 * 특전 상태를 영어로 옮긴다.
 * `secret`(구성 비공개)과 `unknown`(우리가 확인 못함)을 절대 합치지 않는다 —
 * "판매처가 안 밝힘"과 "우리가 모름"은 정반대 정보다. 국내판이 지키는 구분과 같다.
 */
/**
 * 한국어 특전 문구 → 영어 요약. 못 뽑으면 원문을 그대로 둔다(i18n-benefit.mjs의 계약).
 * 요약이 되더라도 **원문을 버리지 않는다** — title로 남겨서 GOM이 대조할 수 있게 한다.
 * 실측: 특전 문구 79건 중 79건이 요약된다.
 */
function pobText(list) {
  const ko = list.map(cleanPob).join(' · ');
  /**
   * **문구는 하나씩 요약하고, 수식어는 묶음 전체에 한 번만 붙인다.**
   *
   * benefitLine()은 품목과 수식어를 한 줄로 평탄화해서 준다. 그걸 문구마다 부르면
   * 수식어가 문구 수만큼 반복된다. TXT 알라딘(8행) 실측:
   *
   *   … 3 of 5, random · while supplies last · … 1 of 5, random · while supplies last
   *   · … (while supplies last가 **8번**)
   *
   * summarizeBenefit()은 {items, notes}로 나눠 주니 notes만 걷어내 끝에 한 번 붙인다.
   *
   * 품목은 **문구 단위로** 묶는다. 한 문구 안의 여러 품목은 실제로 같이 주는 것이라
   * "+"로 잇고(원문도 "+"·"&"였다), 문구끼리는 에디션별 대안이라 "·"로 나눈다.
   * 전부 "+"로 이으면 8종을 다 받는다는 말이 된다.
   *
   * 합쳐서 한 번에 요약하면 안 된다 —
   *   원문  미공개 포토카드 2종 중 1종 랜덤 · 미공개 포토카드 2종 중 2종 랜덤
   *   합쳐서  unreleased photocard, 1 of 2, random   ← 뒤의 "2 of 2"가 사라진다
   * 같은 품목이라 중복 제거에 걸려버린 것이다. 문법은 멀쩡하고 뜻만 틀린 요약,
   * i18n-benefit이 경계한 바로 그 실패다.
   */
  const seen = new Set();
  const lines = [];
  const notes = [];
  for (const b of list) {
    const sum = summarizeBenefit(b);
    if (!sum) continue;
    for (const n of sum.notes) if (!notes.includes(n)) notes.push(n);
    const line = sum.items.map((i) => (i.count ? `${i.what}, ${i.count}` : i.what)).join(' + ');
    if (!line || seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  // 품목을 하나도 못 뽑았는데 수식어만 남는 경우가 있다(조건문만 있는 문구).
  // 그때는 요약이라 부를 수 없어 원문을 보여준다.
  if (lines.length) lines.push(...notes);
  return lines.length
    ? `<span class="pob" title="${esc(ko)}">${esc(lines.join(' · '))}</span><span class="ko">${esc(ko)}</span>`
    : `<span class="pob">${esc(ko)}</span>`;
}

function pobCell(r) {
  /**
   * **상태가 "없음"이면 문구가 있어도 특전이 아니다.**
   * 실측: 11행이 benefit 내용을 갖고 있으면서 상태가 has가 아니다
   * (none 7 — 알라딘 6·사운드웨이브 1, ended 4 — 알라딘).
   * none 쪽을 열어보니 특전이 아니라 **앨범 구성품** 문구였다
   * ("아웃박스+미니 프로젝터 토이 카메라+메탈 다이스…"). 그대로 실으면 구성품이
   * 특전으로 둔갑한다. 상태를 믿는다. (수집 쪽 문제라 인계했다)
   */
  if (r.benefitStatus === 'none') return '<span class="no">None listed</span>';
  if (r.benefit?.length) return pobText(r.benefit);
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
  /**
   * **에디션 수를 센다.** key는 `에디션｜포장`이라 같은 버전의 낱개와 세트가 따로 잡힌다 —
   * 국내판 탭이 5개인데 7이 나오던 것과 같은 문제다(docs/38-수집단계-인계.md 6·7번).
   * 팬이 "몇 종"이라 할 때 세는 건 에디션이다.
   */
  const versions = new Set(rows.map((r) => String(r.key || r.editionKey || '').split('｜')[0])).size;
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
      // 상태가 none뿐인 판매처는 문구가 있어도 특전이 아니다(pobCell 주석 참고)
      const onlyNone = s.status.size === 1 && s.status.has('none');
      const pob = s.pob.size && !onlyNone ? pobText([...s.pob]) : pobCell(s.rows[0]);
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

export function renderEnIndex({
  albums,
  stamp,
  siteUrl,
  shortDate,
  /**
   * 이 앨범의 영어판이 실제로 있는지.
   *
   * `expired`만 걸렀더니 **영어 인덱스가 404를 링크하고 있었다** — 실측으로
   * `/en`이 `album/red-velvet-velvet-summer`를 걸었는데 그 파일은 만들어진 적이 없다.
   * 예판이 끝나 이번 빌드에서 다시 안 그린 앨범은 국내판 HTML만 예전 것이 남는다.
   *
   * 사이트맵과 hreflang은 코드 레인이 같은 이유로 막았는데(`c69db16`) 인덱스는
   * 안 덮였다. 목록에서 눌러 404를 보는 건 크롤러가 아니라 사람이라 더 나쁘다.
   *
   * 파일 존재를 기본값으로 두되 주입할 수 있게 남긴다 — 렌더러를 파일시스템 없이
   * 부르는 테스트가 그대로 돌아야 한다. 이 함수는 영어판을 다 쓴 뒤에 불린다.
   */
  hasEn = (slug) => existsSync(`./out/en/album/${slug}.html`),
}) {
  const live = albums.filter((a) => !a.expired && hasEn(a.slug));
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
