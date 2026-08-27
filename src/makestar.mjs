import { getText } from './fetchx.mjs';

/**
 * 메이크스타 — 팬사인회·영상통화·럭키드로우의 유일한 출처.
 *
 * 다른 5사(위버스샵·알라딘·Ktown4u·사운드웨이브·위드뮤)는 팬싸를 아예 안 다룬다.
 *   위버스샵 eventGuides 37건 → BENEFIT 타입만
 *   알라딘·사운드웨이브 "팬사인회" 검색 → 0건
 *
 * 처음엔 검색 페이지를 헤드리스로 열어 렌더된 본문 텍스트를 긁었다. 그 방식은
 * 검색이 아티스트명에 민감해 16개 앨범 중 5개에만 붙었고, 무엇보다
 * **"이벤트 없음"과 "검색이 못 찾음"을 구분하지 못했다.**
 *
 * 사이트가 Nuxt이고 그 커머스 API가 열려 있다. 진행 중 이벤트를 **전량** 준다:
 *   GET /v2/commerce/product_event/events/?eventFilterStatus=ON_SALE&size=200
 *
 * 전량을 한 번 받아 두고 로컬에서 매칭한다. 그래서
 *   ① 검색어 민감도가 사라지고 ② 브라우저가 필요 없고 ③ 없으면 정말로 없는 것이다.
 *
 * HTML 페이지(makestar.co/event/{id})는 여전히 429로 막힌다. 링크로만 쓴다.
 */

const API = 'https://new-commerce-api.makestar.com';
export const SITE = 'https://makestar.co';

// 메이크스타의 이벤트 분류. MEET&CALL·VIDEOCALL이 영상통화 팬사인회다.
const LABEL = {
  'MEET&CALL': '영상통화 팬사인회',
  VIDEOCALL: '영상통화 팬사인회',
  FANSIGN: '대면 팬사인회',
  PHOTOCARD: '예약 특전 포토카드',
  LUCKYDRAW: '럭키드로우',
  FUNDING: '펀딩',
  GOODS: '굿즈',
  ETC: '기타 이벤트',
};

// 팬이 "팬싸"라고 부르는 것 — 응모 경쟁이 붙고 돈이 크게 들어간다
const FANSIGN_TYPES = new Set(['MEET&CALL', 'VIDEOCALL', 'FANSIGN']);

const i18n = (o, lang = 'ko') => (o && (o[lang] || o.ko || o.en)) || '';
const ymd = (iso) => (iso || '').slice(0, 10).replace(/-/g, '.');

async function json(url) {
  return JSON.parse(await getText(url));
}

let _all = null; // 빌드당 1회만 받는다

/** 진행 중(ON_SALE) 이벤트 전량 */
export async function allEvents() {
  if (_all) return _all;
  const out = [];
  // size=200이 서버 상한이다. 그 이상은 200으로 깎여 돌아온다.
  for (let page = 0; page < 10; page++) {
    const u = `${API}/v2/commerce/product_event/events/?eventFilterStatus=ON_SALE&sortBy=RECOMMENDED&baseCurrency=krw&size=200&page=${page}`;
    const j = await json(u);
    const d = Array.isArray(j.data) ? j.data : [];
    out.push(...d.map(normalize));
    if (!j.meta?.hasNext) break;
  }
  _all = out;
  return out;
}

function normalize(e) {
  const type = e.eventCategory?.name || 'ETC';
  const end = e.salesData?.salesEndAt ? new Date(e.salesData.salesEndAt) : null;
  const dday = end ? Math.ceil((end.getTime() - Date.now()) / 864e5) : null;
  return {
    id: e.id,
    url: `${SITE}/event/${e.id}`,
    type,
    label: LABEL[type] || type,
    fansign: FANSIGN_TYPES.has(type),
    title: i18n(e.title),
    titleEn: i18n(e.title, 'en'),
    album: i18n(e.product?.title),
    albumEn: i18n(e.product?.title, 'en'),
    artist: i18n(e.artist?.i18nName || e.product?.artist?.i18nName),
    artistEn: i18n(e.artist?.i18nName || e.product?.artist?.i18nName, 'en'),
    releaseDate: (e.product?.releasedAt || '').slice(0, 10),
    from: ymd(e.salesData?.salesStartAt),
    to: ymd(e.salesData?.salesEndAt),
    dday: dday != null && dday >= 0 ? dday : null,
    closing: dday != null && dday <= 2,
    winnerAt: (e.eventInfo?.winnerAnnounceAt || '').slice(0, 10).replace(/-/g, '.') || null,
    productId: e.product?.id ?? null,
  };
}

// ── 매칭 ────────────────────────────────────────────────────
//
// 신호 셋 중 둘 이상이 맞아야 붙인다. 하나만으로는 붙이지 않는다.
//   아티스트 — 소속사가 멤버 솔로를 그룹 계정으로 파는 경우가 있어 단독으론 약하다
//   앨범명   — 위버스샵은 영어 제목, 국내는 한국어 제목을 쓴다 (양쪽 다 대조한다)
//   발매일   — 제목이 영영 안 맞는 앨범을 건지는 마지막 끈이다
//
// 예: 위버스샵은 [끝내주는 인생]을 i-dle 계정에서 What a Wonderful Life로 판다.
//     메이크스타는 같은 앨범을 "소연 / 정규 [끝내주는 인생]"으로 연다.
//     아티스트는 안 맞지만 앨범명(en·ko)과 발매일이 맞아 붙는다.

// 공백까지 지우면 안 된다. "TUNE"이 "TUNEXX" 안에서 발견돼 TUIDE의 [TUNE & PLAY]가
// 튜넥스(TUNEXX)의 이벤트에 붙어버렸다. 그래서 두 가지를 따로 쓴다.
//   norm  — 기호·공백을 전부 지운 형태. "NCT 127" == "NCT127" 같은 동일성 판정용
//   soft  — 기호만 공백으로 바꾼 형태. 낱말 경계를 지켜 포함 여부를 볼 때 쓴다
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
const soft = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .trim();

/** 낱말 경계를 지키는 포함 검사 — 앞뒤가 공백이거나 문자열 끝이어야 한다 */
function hasWord(hay, needle) {
  if (!needle) return false;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) {
    const okStart = i === 0 || hay[i - 1] === ' ';
    const okEnd = i + needle.length === hay.length || hay[i + needle.length] === ' ';
    if (okStart && okEnd) return true;
  }
  return false;
}

function hitArtist(names, ev) {
  const hay = soft([ev.artist, ev.artistEn].join(' '));
  const exact = new Set([ev.artist, ev.artistEn].map(norm).filter((s) => s.length >= 2));
  for (const raw of names) {
    if (exact.has(norm(raw))) return true;
    const n = soft(raw);
    if (n.replace(/\s/g, '').length >= 2 && hasWord(hay, n)) return true;
  }
  return false;
}

function hitAlbum(token, album, ev) {
  const hay = soft([ev.album, ev.albumEn, ev.title, ev.titleEn].join(' '));
  // 앨범명 전체를 먼저 본다 — 토큰보다 구체적이라 오탐이 적다
  for (const t of [album, token]) {
    const n = soft(t);
    if (n.replace(/\s/g, '').length >= 3 && hasWord(hay, n)) return true;
  }
  return false;
}

function hitDate(deliveryDate, ev) {
  if (!deliveryDate || !ev.releaseDate) return false;
  const a = new Date(deliveryDate).getTime();
  const b = new Date(ev.releaseDate).getTime();
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 10 * 864e5;
}

/**
 * 앨범 하나에 붙는 이벤트를 고른다.
 * @param {{artists: string[], album: string, token: string, deliveryDate?: string}} t
 */
export async function eventsFor(t) {
  const all = await allEvents();
  const out = [];
  for (const ev of all) {
    const why = [];
    if (hitArtist(t.artists || [], ev)) why.push('아티스트');
    if (hitAlbum(t.token || '', t.album || '', ev)) why.push('앨범명');
    if (hitDate(t.deliveryDate, ev)) why.push('발매일');
    if (why.length >= 2) out.push({ ...ev, why });
  }
  // 팬싸를 위로, 그 다음 마감 임박 순
  return out.sort((a, b) => Number(b.fansign) - Number(a.fansign) || (a.dday ?? 999) - (b.dday ?? 999));
}

// ── 상세 (응모 가능 버전과 가격) ─────────────────────────────
//
// 목록엔 가격이 없다. 상세를 봐야 "어떤 버전을 얼마에 사면 응모되는지"가 나온다.
// 붙기로 정해진 이벤트만 열기 때문에 빌드당 십수 건이고, 평범한 fetch다.

const _detail = new Map();

export async function detail(id) {
  if (_detail.has(id)) return _detail.get(id);
  let v = { options: [] };
  try {
    const j = await json(`${API}/v2/commerce/product_event/${id}/`);
    const opts = j.data?.salesData?.productOptions || [];
    v = {
      options: opts.map((o) => ({
        name: i18n(o.name),
        krw: o.salesData?.price?.krw ?? null,
        // 이 옵션을 사면 실제로 무엇이 오는지 (앨범 버전·랜덤 여부)
        items: (o.itemsInfo || []).map((it) => i18n(it.contentName)).filter(Boolean),
      })),
    };
  } catch {
    // 상세가 막혀도 목록 정보만으로 충분히 쓸모 있다
  }
  _detail.set(id, v);
  return v;
}

/** 매칭된 이벤트에 옵션·가격을 채워 넣는다 */
export async function withOptions(events) {
  const out = [];
  for (const e of events) out.push({ ...e, ...(await detail(e.id)) });
  return out;
}

export { LABEL };
