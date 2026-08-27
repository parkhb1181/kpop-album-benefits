import { writeFileSync, mkdirSync } from 'node:fs';
import { matchesAlbum } from './src/fetchx.mjs';
import { discoverPreorders } from './src/discover.mjs';
import { renderAlbum, renderIndex, slugify } from './src/render.mjs';
import * as kt from './src/ktown4u.mjs';
import * as ala from './src/aladin.mjs';
import * as wev from './src/weverse.mjs';
import * as sw from './src/soundwave.mjs';

const ONLY = process.argv.slice(2).find((a) => !a.startsWith('-')); // 특정 앨범만 빌드
const MAX = Number((process.argv.find((a) => a.startsWith('--max=')) || '').split('=')[1] || 0);

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

  // 위버스샵
  try {
    rows.push(...(await wev.search(t.artistId, t.album)).filter((x) => matchesAlbum(x.title, token)));
  } catch (e) {
    errors.push(`위버스샵: ${e.message}`);
  }

  return { rows, errors };
}

// ── 실행 ─────────────────────────────────────────────────────
const stamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
console.log('컴백 탐지 중…');
const disc = await discoverPreorders({ concurrency: 8 });
let targets = disc.albums.map((a) => ({ ...a, artist: a.artistEn }));
if (ONLY) targets = targets.filter((t) => new RegExp(ONLY, 'i').test(t.album) || new RegExp(ONLY, 'i').test(t.artist));
if (MAX) targets = targets.slice(0, MAX);
console.log(`예판 앨범 ${disc.albums.length}개 중 ${targets.length}개 빌드\n`);

mkdirSync('./out/album', { recursive: true });
const index = [];

for (const t of targets) {
  const slug = slugify(`${t.artist}-${t.album}`);
  process.stdout.write(`  ${t.artist} — ${t.album} … `);
  const { rows, errors } = await collectAlbum(t);
  if (rows.length === 0) {
    console.log('수집 0건, 건너뜀');
    continue;
  }
  const versions = new Set(rows.map((r) => r.key)).size;
  const retailers = new Set(rows.map((r) => r.retailer)).size;
  const benefitCount = new Set(rows.filter((r) => (r.benefit || []).length).map((r) => r.retailer)).size;
  const soldCount = rows.filter((r) => r.soldOut === true).length;

  writeFileSync(`./out/album/${slug}.html`, renderAlbum({ target: t, rows, errors, stamp }), 'utf8');
  index.push({ ...t, slug, versions, retailers, benefitCount, soldCount, rowCount: rows.length });
  console.log(`${rows.length}건 / ${versions}종 / ${retailers}사${benefitCount ? ` / 특전 ${benefitCount}사` : ''}`);
}

index.sort((a, b) => b.benefitCount - a.benefitCount || b.retailers - a.retailers || b.versions - a.versions);
writeFileSync('./out/index.html', renderIndex({ albums: index, stamp }), 'utf8');
writeFileSync('./out/index.json', JSON.stringify({ stamp, albums: index }, null, 2), 'utf8');

console.log(`\n완료 — 앨범 ${index.length}개 페이지 + 인덱스`);
console.log(`  2개 이상 판매처: ${index.filter((a) => a.retailers >= 2).length}개`);
console.log(`  특전 2곳 이상 비교 가능: ${index.filter((a) => a.benefitCount >= 2).length}개`);
