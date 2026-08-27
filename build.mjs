import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { matchesAlbum } from './src/fetchx.mjs';
import { discoverPreorders } from './src/discover.mjs';
import { renderAlbum, renderIndex, slugify } from './src/render.mjs';
import { sitemap, robots, koreanArtistFrom, displayArtist, abs } from './src/seo.mjs';
import { renderCard, hashesFor } from './src/ogcard.mjs';
import * as kt from './src/ktown4u.mjs';
import * as ala from './src/aladin.mjs';
import * as wev from './src/weverse.mjs';
import * as sw from './src/soundwave.mjs';
import * as wm from './src/withmuu.mjs';
import * as mks from './src/makestar.mjs';
import { collectDeadlines, roughLeft } from './src/deadlines.mjs';
import { calendar } from './src/ics.mjs';
import { close as closeBrowser, isDisabled } from './src/browser.mjs';

const ONLY = process.argv.slice(2).find((a) => !a.startsWith('-')); // 특정 앨범만 빌드
const MAX = Number((process.argv.find((a) => a.startsWith('--max=')) || '').split('=')[1] || 0);

/**
 * 배포 도메인. canonical·og:url·sitemap이 절대주소를 요구한다.
 * 비어 있으면 그 셋을 아예 안 낸다 — 틀린 도메인을 박는 것보다 없는 게 낫다.
 * 로컬:  SITE_URL= node build.mjs
 * 배포:  Vercel 환경변수에 SITE_URL=https://도메인
 */
const SITE_URL = (process.env.SITE_URL || '').trim().replace(/\/$/, '');

/**
 * "2026. 8. 27. 오전 10:06:57" → "2026-08-27".
 * sitemap의 lastmod는 날짜 형식이어야 하고, 종료 배너에도 같은 값을 쓴다.
 */
function shortStamp(s) {
  if (!s) return new Date().toISOString().slice(0, 10);
  const m = String(s).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return new Date().toISOString().slice(0, 10);
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

// 앨범 제목에 흔히 붙는 말들. 이걸 매칭 토큰으로 쓰면 남의 앨범까지 통과한다.
const STOPWORDS =
  /^(album|mini|single|full|part|the|and|vol|ver|version|live|edition|repackage|special|정규|미니|싱글|앨범|리패키지)$/i;

/** 앨범명에서 다른 앨범과 섞이지 않을 토큰을 만든다 */
function matchToken(album) {
  const words = album
    .replace(/[''""']/g, '')
    .split(/[\s:·\-&+()[\]]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.test(w) && !/^\d+(st|nd|rd|th)?$/i.test(w));
  if (words.length) return words.sort((a, b) => b.length - a.length)[0];
  // 전부 불용어면 앨범명 전체를 쓴다 (matchesAlbum이 기호를 무시하고 비교한다)
  return album;
}

/** "i-dle (아이들)" 처럼 병기된 이름은 검색을 방해한다 → 후보를 여러 개 만든다 */
function nameVariants(artistEn) {
  const base = artistEn.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  const inside = (artistEn.match(/\(([^)]+)\)/) || [])[1];
  return [...new Set([base, inside, artistEn].filter(Boolean))];
}

/**
 * 결과가 없으면 아티스트명을 바꿔가며 재시도, 마지막엔 앨범명만으로.
 *
 * 그래도 0건이면 최후 폴백: **아티스트명만 검색하고 발매일로 고른다.**
 * 위버스샵은 영어 부제(`What a Wonderful Life`)를 쓰는데 국내 판매처는
 * 한국어 정식 제목(`끝내주는 인생`)을 써서, 제목으로는 영영 못 만나는 경우가 있다.
 */
async function searchWide(fn, t, token, limit = 25) {
  for (const q of [...nameVariants(t.artistEn).map((n) => `${n} ${t.album}`), t.album]) {
    try {
      const r = (await fn(q)).filter((x) => matchesAlbum(x.title, token));
      if (r.length) return r.slice(0, limit);
    } catch {}
  }

  if (!t.deliveryDate) return [];
  const target = new Date(t.deliveryDate).getTime();
  for (const n of nameVariants(t.artistEn)) {
    try {
      const all = await fn(n);
      const near = all.filter((x) => {
        if (!x.releaseDate) return false;
        const d = new Date(x.releaseDate.length === 7 ? `${x.releaseDate}-01` : x.releaseDate).getTime();
        return Number.isFinite(d) && Math.abs(d - target) <= 21 * 864e5; // ±3주
      });
      if (near.length) return near.slice(0, limit);
    } catch {}
  }
  return [];
}

async function collectAlbum(t) {
  const rows = [];
  const errors = [];
  const token = matchToken(t.album);

  // Ktown4u
  try {
    const r = await searchWide(kt.search, t, token);
    for (const x of r) {
      try {
        const d = await kt.detail(x.id);
        x.benefit = d.benefit;
        x.images = d.images;
        x.benefitStatus = d.status;
        x.benefitFlag = d.benefit.length > 0;
      } catch {
        x.benefitStatus = 'unknown';
      }
      rows.push(x);
    }
  } catch (e) {
    errors.push(`Ktown4u: ${e.message}`);
  }

  // 알라딘 — 검색결과엔 "증정 종료"만 있어 진행 중 특전은 상세를 봐야 한다
  try {
    const list = await searchWide(ala.search, t, token, 20);
    for (const x of list) {
      try {
        const d = await ala.detail(x.id);
        if (d.benefit.length) x.benefit = d.benefit;
        x.benefitFlag = d.benefit.length > 0;
        x.coupons = d.coupons;
        x.freeShipping = d.freeShipping;
        x.benefitStatus = d.status;
      } catch {
        x.benefitStatus = 'unknown';
      }
      rows.push(x);
    }
  } catch (e) {
    errors.push(`알라딘: ${e.message}`);
  }

  // 사운드웨이브 (카페24, 정적)
  try {
    const list = await searchWide(sw.search, t, token, 20);
    for (const x of list) {
      try {
        const d = await sw.detail(x.url);
        if (d.benefit.length) x.benefit = d.benefit;
        x.benefitFlag = d.benefit.length > 0;
        x.benefitStatus = d.status;
      } catch {
        x.benefitStatus = 'unknown';
      }
      rows.push(x);
    }
  } catch (e) {
    errors.push(`사운드웨이브: ${e.message}`);
  }

  // 위드뮤 (헤드리스 필요 — playwright가 없으면 조용히 0건)
  //
  // 상세는 열지 않는다. 페이지마다 브라우저를 띄워야 하는데 특전 문구가 안 나와서
  // (실측: benefit 0건) 비용만 들고 얻는 게 없다. 목록에서 가격·재고만 가져온다.
  try {
    // 아티스트명으로 한 번만 검색한다 — 브라우저 페이지를 앨범당 1회로 묶기 위해서다
    const nv = nameVariants(t.artistEn);
    const list = (await wm.search(nv[0] || t.artistEn)).filter((x) => matchesAlbum(x.title, token)).slice(0, 20);
    rows.push(...list);
  } catch (e) {
    errors.push(`위드뮤: ${e.message}`);
  }

  // 위버스샵
  try {
    rows.push(...(await wev.search(t.artistId, t.album)).filter((x) => matchesAlbum(x.title, token)));
  } catch (e) {
    errors.push(`위버스샵: ${e.message}`);
  }

  // 팬사인회·영상통화 — 메이크스타에만 있다.
  //
  // 검색하지 않는다. 진행 중 이벤트 **전량**을 한 번 받아두고(빌드당 1회) 로컬에서 고른다.
  // 검색을 쓰던 때는 아티스트명 표기가 조금만 달라도 0건이 나왔고, 그래서
  // "이벤트가 없다"와 "검색이 못 찾았다"를 구분할 수 없었다.
  let events = [];
  try {
    const matched = await mks.eventsFor({
      artists: nameVariants(t.artistEn),
      album: t.album,
      token,
      deliveryDate: t.deliveryDate,
    });
    events = await mks.withOptions(matched); // 어떤 버전을 얼마에 사야 응모되는지
  } catch (e) {
    errors.push(`메이크스타: ${e.message}`);
  }

  return { rows, errors, events };
}

// ── 실행 ─────────────────────────────────────────────────────
const stamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
console.log('컴백 탐지 중…');
const disc = await discoverPreorders({ concurrency: 8 });
let targets = disc.albums.map((a) => ({ ...a, artist: a.artistEn }));
if (ONLY) targets = targets.filter((t) => new RegExp(ONLY, 'i').test(t.album) || new RegExp(ONLY, 'i').test(t.artist));
if (MAX) targets = targets.slice(0, MAX);
console.log(`예판 앨범 ${disc.albums.length}개 중 ${targets.length}개 빌드`);

// 이벤트는 앨범별로 검색하지 않고 전량을 한 번 받는다. 여기서 실패하면 이벤트만 빠진다.
let eventTotal = 0;
try {
  eventTotal = (await mks.allEvents()).length;
  console.log(`메이크스타 진행 중 이벤트 ${eventTotal}건 확보\n`);
} catch (e) {
  console.log(`⚠ 메이크스타 이벤트 목록 실패: ${e.message}\n`);
}

mkdirSync('./out/album', { recursive: true });
mkdirSync('./out/data', { recursive: true });
mkdirSync('./out/alarm', { recursive: true });
mkdirSync('./out/og', { recursive: true });

// 카드는 내용이 바뀐 앨범만 다시 굽는다. 이유는 ogcard.mjs의 hashesFor 주석 참고.
const cardHashes = hashesFor('./out/og');
const cardStat = { written: 0, skipped: 0, failed: 0 };
// 카드에 찍는 날짜. "2026-08-27" → "2026.8.27"
const cardDate = shortStamp(stamp).replace(/-0?/g, '.');

// 사이트 전체 마감을 모은 캘린더. 구독하면 리빌드마다 알아서 갱신된다.
const allAlarms = [];

/** 특정 앨범만 빌드했는가 (`node build.mjs TAEMIN`, `--max=5`) */
const PARTIAL = Boolean(ONLY || MAX);

/**
 * 마감 → 캘린더 일정.
 * 새로 수집한 앨범과 스냅샷에서 되살린 앨범이 **같은 모양**을 내야 한다.
 * UID가 어긋나면 구독 캘린더에 같은 일정이 두 개 생긴다.
 */
function alarmsFrom(slug, artistName, album, deadlines) {
  return deadlines.map((d) => ({
    // UID를 고정해야 구독 캘린더가 일정을 **갱신**한다. 매번 새로 만들면 중복이 쌓인다.
    uid: `${slug}-${d.id}@kpop-album-benefits`,
    at: d.at,
    title: `${artistName} ${album} — ${d.label}`,
    desc: [d.note, d.url].filter(Boolean).join('\n'),
    url: d.url || (SITE_URL ? `${SITE_URL}/album/${slug}.html` : undefined),
  }));
}

/** 이번에 안 돈 앨범의 알람을 out/data 스냅샷에서 되살린다 (부분 빌드용) */
function alarmsFromSnapshot(a) {
  try {
    const d = JSON.parse(readFileSync(`./out/data/${a.slug}.json`, 'utf8'));
    const dl = collectDeadlines({ rows: d.rows || [], events: mks.refresh(d.events || []) });
    const name = displayArtist(d.target?.artist || a.artist, d.artistKo || a.artistKo);
    return alarmsFrom(a.slug, name, d.target?.album || a.album, dl);
  } catch {
    return []; // 스냅샷이 없으면 그 앨범 알람만 빠진다
  }
}

/** 지난 인덱스에서 들고 온 카드의 "남은 시간" 초기값을 지금 기준으로 다시 쓴다 */
function refreshRough(a) {
  if (!a.nextDeadline?.at) return a;
  const ms = new Date(a.nextDeadline.at).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return { ...a, nextDeadline: null };
  return { ...a, nextDeadline: { ...a.nextDeadline, rough: roughLeft(ms) } };
}

/**
 * 지난 빌드 결과. 예판이 끝나 discover에서 빠진 앨범을 찾는 데 쓴다.
 *
 * 그 페이지를 지우지 않는 이유 — 예판이 끝나도 검색에는 계속 걸린다.
 * (`태민 판매처별 특전` 구글 1페이지에 2017년 네이버 블로그 글이 있다.)
 * 대신 "예약판매 종료"를 맨 위에 박아 낡은 정보를 현재처럼 보이지 않게 한다.
 */
const prev = (() => {
  try {
    return JSON.parse(readFileSync('./out/index.json', 'utf8'));
  } catch {
    return { stamp: null, albums: [] };
  }
})();

const index = [];

for (const t of targets) {
  const slug = slugify(`${t.artist}-${t.album}`);
  process.stdout.write(`  ${t.artist} — ${t.album} … `);
  const { rows, errors, events } = await collectAlbum(t);
  if (rows.length === 0) {
    console.log('수집 0건, 건너뜀');
    continue;
  }
  const versions = new Set(rows.map((r) => r.key)).size;
  const retailers = new Set(rows.map((r) => r.retailer)).size;
  const benefitCount = new Set(rows.filter((r) => (r.benefit || []).length).map((r) => r.retailer)).size;
  const soldCount = rows.filter((r) => r.soldOut === true).length;

  // 위버스샵은 영문명만 준다. 국내 팬은 한글로 검색하므로 국내 판매처 상품명에서 역으로 얻는다.
  const artistKo = koreanArtistFrom(
    rows.filter((r) => /알라딘|사운드웨이브|예스24/.test(r.retailer || '')).map((r) => r.title)
  );
  const ogImage = rows.find((r) => r.benefitImage)?.benefitImage || rows.find((r) => r.thumb)?.thumb || null;

  // 마감 카운트다운 + 캘린더 알람
  const deadlines = collectDeadlines({ rows, events });
  const artistName = displayArtist(t.artist, artistKo);
  const alarms = alarmsFrom(slug, artistName, t.album, deadlines);
  if (alarms.length) {
    writeFileSync(`./out/alarm/${slug}.ics`, calendar({ name: `${artistName} ${t.album} 마감`, events: alarms }), 'utf8');
    allAlarms.push(...alarms);
  }

  // 공유 카드. og:image는 절대주소를 요구하므로 SITE_URL이 없으면 굽기만 하고 물리지는 않는다
  // (로컬에서 out/og/*.png로 눈으로 확인할 수는 있다).
  const card = await renderCard({
    slug,
    artist: artistName,
    album: t.album,
    rows,
    hashes: cardHashes,
    shortDate: cardDate,
  });
  cardStat[card === 'written' ? 'written' : card === 'skipped' ? 'skipped' : 'failed']++;
  const ogCard = card && SITE_URL ? abs(SITE_URL, `og/${slug}.png`) : null;

  writeFileSync(
    `./out/album/${slug}.html`,
    renderAlbum({
      target: t,
      rows,
      errors,
      events,
      eventTotal,
      deadlines,
      stamp,
      siteUrl: SITE_URL,
      slug,
      artistKo,
      ogCard,
    }),
    'utf8'
  );
  // 예판이 끝난 뒤 페이지를 "종료" 상태로 다시 그리려면 원본이 필요하다
  writeFileSync(`./out/data/${slug}.json`, JSON.stringify({ target: t, rows, events, artistKo, stamp }), 'utf8');
  index.push({
    ...t,
    slug,
    versions,
    retailers,
    benefitCount,
    soldCount,
    eventCount: events.length,
    fansignCount: events.filter((e) => e.fansign).length,
    // 인덱스 카드에도 가장 가까운 마감 하나를 실시간으로 띄운다
    nextDeadline: deadlines[0]
      ? { label: deadlines[0].label, at: deadlines[0].at, rough: roughLeft(deadlines[0].ms - Date.now()) }
      : null,
    rowCount: rows.length,
    artistKo,
    artistDisplay: displayArtist(t.artist, artistKo),
    ogImage,
  });
  console.log(`${rows.length}건 / ${versions}종 / ${retailers}사${benefitCount ? ` / 특전 ${benefitCount}사` : ''}`);
}

// ── 예판이 끝난 앨범 ────────────────────────────────────────
// 지난 인덱스에 있었는데 이번 discover에 없으면 예판이 끝난 것이다.
// ONLY/MAX로 일부만 빌드한 경우는 "빠진 것"이 아니라 "안 돈 것"이라 건너뛴다.
const live = new Set(index.map((a) => a.slug));
const gone = ONLY || MAX ? [] : (prev.albums || []).filter((a) => !live.has(a.slug));
console.log(`\n지난 인덱스 ${(prev.albums || []).length}개 · 이번 ${index.length}개 · 빠짐 ${gone.length}개`);
for (const a of gone) {
  try {
    const d = JSON.parse(readFileSync(`./out/data/${a.slug}.json`, 'utf8'));
    const expired = { lastSeen: shortStamp(a.expired?.lastSeen || d.stamp || prev.stamp) };
    writeFileSync(
      `./out/album/${a.slug}.html`,
      renderAlbum({
        target: d.target,
        rows: d.rows,
        errors: [],
        // 스냅샷의 dday는 그때 값이다. 다시 계산하지 않으면 몇 주 전에 끝난 이벤트가
        // "D-3"이라고 우긴다.
        events: mks.refresh(d.events || []),
        eventTotal: 0,
        stamp,
        siteUrl: SITE_URL,
        slug: a.slug,
        artistKo: d.artistKo,
        expired,
        // 예판이 끝나도 카드는 다시 굽지 않는다 — 살아 있을 때 구운 걸 그대로 쓴다.
        // 종료된 앨범도 검색·공유로는 계속 닿는다(위 주석 참고).
        ogCard: SITE_URL && existsSync(`./out/og/${a.slug}.png`) ? abs(SITE_URL, `og/${a.slug}.png`) : null,
      }),
      'utf8'
    );
    // nextDeadline은 지난 인덱스에서 딸려온 값이다. 그대로 두면 예판이 끝난 카드에
    // 카운트다운이 계속 돈다 — 마감이 아직 미래인 이벤트가 남아 있으면 더 그렇다.
    index.push({ ...a, nextDeadline: null, expired });
  } catch {
    // 스냅샷이 없으면(이전 버전에서 만든 페이지) 그대로 둔다 — 지우는 것보다 낫다
    index.push({ ...a, nextDeadline: null, expired: a.expired || { lastSeen: shortStamp(prev.stamp) } });
  }
}
if (gone.length) console.log(`\n예판 종료 ${gone.length}개 — "종료" 표시로 유지`);

/**
 * 인덱스·sitemap·alarm.ics에 실을 전체 목록.
 *
 * 부분 빌드(`node build.mjs TAEMIN`, `--max=`)에서는 index에 이번에 돈 앨범만 들어 있다.
 * 그걸 그대로 쓰면 **인덱스가 앨범 한 개짜리로 덮어써지고** 나머지가 사이트에서 사라진다.
 * out/은 저장소에 커밋되므로 그대로 배포된다. README가 부분 빌드를 정상 사용법으로
 * 안내하고 있어서, 평범하게 쓰다가 배포물이 깨졌다.
 *
 * 그래서 부분 빌드일 때는 지난 인덱스에 slug 기준으로 머지한다.
 * 전체 빌드는 지금까지처럼 전량 교체한다 (예판 종료 처리가 여기 얹혀 있다).
 */
const catalog = (() => {
  if (!PARTIAL) return index;
  const built = new Set(index.map((a) => a.slug));
  const carried = (prev.albums || []).filter((a) => !built.has(a.slug)).map(refreshRough);
  // 안 돈 앨범의 알람도 되살려야 alarm.ics가 이번 앨범 것만 남지 않는다.
  // 예판이 끝난 앨범은 제외한다 — 전체 빌드에서는 targets에 없어 알람이 안 생기는데,
  // 여기서만 되살리면 카드엔 카운트다운이 없는데 캘린더엔 일정이 있는 모순이 된다.
  for (const a of carried) if (!a.expired) allAlarms.push(...alarmsFromSnapshot(a));
  console.log(`부분 빌드 — 지난 인덱스에서 ${carried.length}개를 유지하고 ${index.length}개를 갱신합니다`);
  return [...index, ...carried];
})();

// 진행 중인 것을 위로, 그 안에서 특전 많은 순
catalog.sort(
  (a, b) =>
    Number(!!a.expired) - Number(!!b.expired) ||
    b.benefitCount - a.benefitCount ||
    b.retailers - a.retailers ||
    b.versions - a.versions
);
writeFileSync('./out/index.html', renderIndex({ albums: catalog, stamp, siteUrl: SITE_URL }), 'utf8');
writeFileSync('./out/index.json', JSON.stringify({ stamp, albums: catalog }, null, 2), 'utf8');

// 검색 유입이 1순위 채널이다. sitemap이 없으면 앨범 페이지는 사실상 색인되지 않는다.
const today = new Date().toISOString().slice(0, 10);
// sitemap은 절대주소만 담을 수 있다. SITE_URL이 없으면 빈 sitemap을 배포하느니 안 만든다.
// (지난 빌드에서 남은 걸 그대로 두면 틀린 도메인이 배포되므로 지운다)
if (SITE_URL) {
  writeFileSync(
    './out/sitemap.xml',
    sitemap(SITE_URL, [
      { path: '', lastmod: today, changefreq: 'daily', priority: '1.0' },
      // 끝난 앨범도 넣는다 — 검색은 계속 걸린다. 다만 갱신 빈도·우선순위를 낮춘다
      ...catalog.map((a) =>
        a.expired
          ? { path: `album/${a.slug}`, lastmod: a.expired.lastSeen || today, changefreq: 'monthly', priority: '0.3' }
          : { path: `album/${a.slug}`, lastmod: today, changefreq: 'daily', priority: '0.8' }
      ),
    ]),
    'utf8'
  );
} else {
  rmSync('./out/sitemap.xml', { force: true });
}
writeFileSync('./out/robots.txt', robots(SITE_URL), 'utf8');
cardHashes.save();

// 전체 마감 캘린더. 이게 사실상의 "알림 서비스"다 —
// 구독해두면 새 컴백의 마감도 리빌드 때마다 알아서 따라 들어온다.
allAlarms.sort((a, b) => new Date(a.at) - new Date(b.at));
writeFileSync('./out/alarm.ics', calendar({ name: 'K-POP 앨범 마감·팬싸 응모', events: allAlarms }), 'utf8');

console.log(`\n완료 — 이번 빌드 ${index.length}개 · 인덱스 전체 ${catalog.length}개`);
console.log(
  SITE_URL
    ? `  sitemap.xml (${catalog.length + 1}개 URL) · robots.txt — ${SITE_URL}`
    : '  robots.txt — ⚠ SITE_URL 미설정: sitemap·canonical·og:url을 생략했습니다'
);
console.log(`  2개 이상 판매처: ${catalog.filter((a) => a.retailers >= 2).length}개`);
console.log(`  특전 2곳 이상 비교 가능: ${catalog.filter((a) => a.benefitCount >= 2).length}개`);
console.log(`  마감 알람: ${allAlarms.length}건 (앨범 ${catalog.filter((a) => a.nextDeadline).length}개) → alarm.ics`);
console.log(
  `  공유 카드: 새로 ${cardStat.written} · 그대로 ${cardStat.skipped}${cardStat.failed ? ` · 실패 ${cardStat.failed}` : ''}` +
    `${SITE_URL ? '' : ' — ⚠ SITE_URL 미설정이라 og:image에는 물리지 않았습니다'}`
);

await closeBrowser();
