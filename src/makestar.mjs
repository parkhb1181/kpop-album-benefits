import { withPage } from './browser.mjs';

const BASE = 'https://makestar.co';

/**
 * 메이크스타 — 팬사인회·영상통화·럭키드로우 이벤트의 유일한 출처.
 *
 * 다른 4사(위버스샵·알라딘·Ktown4u·사운드웨이브)는 팬싸를 아예 안 다룬다.
 *   위버스샵 eventGuides 37건 → BENEFIT 타입만
 *   알라딘·사운드웨이브 "팬사인회" 검색 → 0건
 * 그래서 여기가 막히면 팬싸 정보는 못 붙인다.
 *
 * SPA라 헤드리스가 필요하고, DOM이 Tailwind 유틸리티 클래스라 셀렉터가 불안정하다.
 * 그래서 렌더된 **본문 텍스트를 패턴으로** 읽는다.
 *
 * 텍스트 형태:
 *   PHOTOCARD 2026.08.05 ~ 08.30 KST D-3 • PRE-ORDER TAEMIN [...] PRE-ORDER PHOTOCARD EVENT 태민
 *   MEET&CALL 2026.08.25 ~ 08.27 KST 마감임박 07:32:35 • PRE-ORDER 도경수(D.O.) ...
 */

// 메이크스타가 쓰는 이벤트 분류. MEET&CALL이 영상통화 팬사인회다.
const TYPES = ['MEET&CALL', 'PHOTOCARD', 'LUCKYDRAW', 'FANSIGN', 'VIDEOCALL', 'ETC', 'FUNDING', 'GOODS'];

const LABEL = {
  'MEET&CALL': '영상통화 팬사인회',
  PHOTOCARD: '예약 특전 포토카드',
  LUCKYDRAW: '럭키드로우',
  FANSIGN: '팬사인회',
  VIDEOCALL: '영상통화',
  ETC: '기타 이벤트',
  FUNDING: '펀딩',
  GOODS: '굿즈',
};

function parseEvents(text) {
  const t = text.replace(/\s+/g, ' ');
  const typeAlt = TYPES.map((x) => x.replace(/[&]/g, '\\&')).join('|');
  const re = new RegExp(
    `(${typeAlt})\\s+(\\d{4}\\.\\d{2}\\.\\d{2})\\s*~\\s*(\\d{2}\\.\\d{2}(?:\\.\\d{2})?)\\s*KST\\s*([\\s\\S]*?)(?=(?:${typeAlt})\\s+\\d{4}\\.\\d{2}\\.\\d{2}|$)`,
    'g'
  );
  const out = [];
  for (const m of t.matchAll(re)) {
    const [, type, from, to, restRaw] = m;
    const rest = restRaw.trim();
    // 상태: D-3 / 마감임박 hh:mm:ss / 판매 종료
    const dday = (rest.match(/^D-(\d+)/) || [])[1];
    const closing = /마감임박/.test(rest);
    const ended = /판매\s*종료|종료됨/.test(rest);
    // 제목: 앞에 붙는 상태 표식을 다 걷어낸다. 순서가 뒤섞여 나와서 반복해서 벗긴다.
    let title = rest;
    for (let i = 0; i < 6; i++) {
      const before = title;
      title = title
        .replace(/^D-\d+\s*/, '')
        .replace(/^마감임박\s*/, '')
        .replace(/^\d{1,3}:\d{2}:\d{2}\s*/, '') // 카운트다운
        .replace(/^•\s*/, '')
        .replace(/^(PRE-?ORDER|NEW|기간한정|판매\s*종료|종료됨)\s*/i, '')
        .trim();
      if (title === before) break;
    }
    title = title.replace(/\s+/g, ' ').trim();
    if (!title) continue;
    out.push({
      type,
      label: LABEL[type] || type,
      from,
      to,
      dday: dday ? Number(dday) : null,
      closing,
      ended,
      title: title.slice(0, 120),
    });
  }
  return out;
}

/** 아티스트명으로 검색해 진행 중인 이벤트를 얻는다 */
export async function events(artist) {
  const text = await withPage(
    `${BASE}/?keyword=${encodeURIComponent(artist)}`,
    (page) => page.evaluate(() => document.body.innerText),
    { settle: 6500, timeout: 40000 }
  );
  if (!text) return [];
  return parseEvents(text).filter((e) => !e.ended);
}

export { parseEvents, LABEL };
