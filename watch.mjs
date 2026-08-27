/**
 * 경량 감시 — "뭔가 새로 떴는가"만 본다.
 *
 * 전체 빌드는 판매처 5곳 × 앨범 16개라 오래 걸린다. 그래서 하루 두 번밖에 못 돈다.
 * 그 주기로는 예판이 열려도 최대 12시간 뒤에 안다. 이걸 줄이는 게 이 스크립트다.
 *
 * 감시는 두 층으로 나눈다. 비용이 100배 차이 나기 때문이다.
 *
 *   A층 (요청 1건)   메이크스타 진행 중 이벤트 목록
 *                   싸고, 넓다 — 실측에서 19건 중 11건이 위버스샵 예판에 없는 앨범이었다.
 *                   새 컴백은 대개 여기 먼저 뜬다.
 *
 *   B층 (요청 158건) 위버스샵 아티스트 158팀 예판 스캔
 *                   앨범 자체를 찾는 유일한 경로다. 위버스샵에는 전체 신상품을
 *                   한 번에 주는 엔드포인트가 없다(`categories/-1/sales`는 400).
 *                   그래서 자주 못 돌린다 — 기본 3시간에 한 번.
 *
 * 변화가 있으면 종료 코드가 아니라 GITHUB_OUTPUT으로 알린다. 워크플로가 그때만
 * 전체 빌드를 돌린다. 변화가 없으면 아무것도 안 하고 끝난다.
 *
 * state/changes.ndjson에 변화를 계속 쌓는다. 나중에 푸시 알림을 붙이면
 * **보낼 내용이 이미 여기에 있다.**
 */

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { discoverPreorders } from './src/discover.mjs';
import * as mks from './src/makestar.mjs';

const STATE = './state/watch.json';
const LOG = './state/changes.ndjson';
const DEEP_MIN = Number(process.env.DEEP_INTERVAL_MIN || 180);
const FORCE_DEEP = process.argv.includes('--deep');

const now = new Date();
const nowIso = now.toISOString();

const prev = (() => {
  try {
    return JSON.parse(readFileSync(STATE, 'utf8'));
  } catch {
    // 첫 실행. 이때는 전부 "새 것"으로 잡히므로 변화로 치지 않는다.
    return null;
  }
})();

const first = !prev;
const sinceDeep = prev?.lastDeep ? (now - new Date(prev.lastDeep)) / 60000 : Infinity;
const deep = FORCE_DEEP || first || sinceDeep >= DEEP_MIN;

// ── A층: 메이크스타 이벤트 (요청 1건) ──────────────────────────
let events = [];
try {
  events = await mks.allEvents();
} catch (e) {
  console.log(`⚠ 메이크스타 실패: ${e.message}`);
  // 목록을 못 받았는데 "전부 사라졌다"고 판단하면 안 된다. 이전 상태를 그대로 둔다.
  events = null;
}

// ── B층: 위버스샵 예판 스캔 (요청 158건) ───────────────────────
let albums = null;
if (deep) {
  try {
    const d = await discoverPreorders({ concurrency: 8 });
    albums = d.albums.map((a) => ({ key: `${a.artistEn}｜${a.album}`, artist: a.artistEn, album: a.album }));
  } catch (e) {
    console.log(`⚠ 위버스샵 스캔 실패: ${e.message}`);
  }
}

// ── 차이 ────────────────────────────────────────────────────
const diff = (nowList, prevList, id) => {
  if (!nowList || !prevList) return { added: [], gone: [] };
  const a = new Set(nowList.map(id));
  const b = new Set(prevList.map(id));
  return {
    added: nowList.filter((x) => !b.has(id(x))),
    gone: prevList.filter((x) => !a.has(id(x))),
  };
};

const ev = diff(events, prev?.events, (e) => String(e.id));
const al = diff(albums, prev?.albums, (a) => a.key);

const changes = [
  ...ev.added.map((e) => ({ type: 'event.new', label: e.label, artist: e.artist, album: e.album, id: e.id, url: e.url, endAt: e.endAt })),
  ...ev.gone.map((e) => ({ type: 'event.gone', label: e.label, artist: e.artist, album: e.album, id: e.id })),
  ...al.added.map((a) => ({ type: 'album.new', artist: a.artist, album: a.album })),
  ...al.gone.map((a) => ({ type: 'album.gone', artist: a.artist, album: a.album })),
];

// ── 기록 ────────────────────────────────────────────────────
mkdirSync('./state', { recursive: true });
writeFileSync(
  STATE,
  JSON.stringify(
    {
      checkedAt: nowIso,
      lastDeep: deep && albums ? nowIso : prev?.lastDeep || null,
      // 요청 실패로 못 받은 층은 이전 값을 유지한다 (사라진 것으로 오인하지 않기 위해)
      events: events ?? prev?.events ?? [],
      albums: albums ?? prev?.albums ?? [],
    },
    null,
    2
  ),
  'utf8'
);

if (changes.length && !first) {
  appendFileSync(LOG, changes.map((c) => JSON.stringify({ at: nowIso, ...c })).join('\n') + '\n', 'utf8');
}

// ── 보고 ────────────────────────────────────────────────────
const tier = deep ? 'A+B (메이크스타 + 위버스샵 158팀)' : 'A (메이크스타만)';
console.log(`감시 ${tier} · 이벤트 ${events?.length ?? '?'}건${albums ? ` · 예판 ${albums.length}개` : ''}`);

if (first) {
  console.log('첫 실행 — 기준선만 저장했습니다. 변화 판정은 다음 회차부터.');
} else if (!changes.length) {
  console.log('변화 없음.');
} else {
  for (const c of changes) {
    const what = { 'event.new': '새 이벤트', 'event.gone': '이벤트 종료', 'album.new': '새 예판', 'album.gone': '예판 종료' }[c.type];
    console.log(`  ${what}: ${c.artist || '?'} — ${c.album || c.label || ''}`);
  }
}

const changed = !first && changes.length > 0;
if (process.env.GITHUB_OUTPUT) {
  // reason은 긁어온 상품명에서 온다 — 남이 쓴 문자열이다.
  // ① 줄바꿈이 들어가면 GITHUB_OUTPUT 형식이 깨져 임의의 출력을 주입할 수 있다
  // ② 워크플로에서는 이 값을 셸 명령에 직접 끼워넣지 않고 env로 넘긴다 (watch.yml 참고)
  const reason =
    changes
      .map((c) => `${c.artist || ''} ${c.album || c.label || ''}`.replace(/[\r\n]+/g, ' ').trim())
      .slice(0, 5)
      .join(', ')
      .slice(0, 200) || '변화 없음';
  appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\nreason=${reason}\n`, 'utf8');
}
