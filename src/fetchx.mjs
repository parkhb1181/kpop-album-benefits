export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

/**
 * @param {string} url
 * @param {{encoding?: string}} [opt] YES24 등 일부 국내몰은 EUC-KR이라 명시가 필요하다
 */
export async function getText(url, opt = {}) {
  // 알라딘이 연속 요청에 503을 준다. 짧게 물러섰다 다시 시도한다.
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, {
      headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8' },
      redirect: 'follow',
    });
    if (res.ok || ![429, 503, 502].includes(res.status)) break;
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`);

  // 응답 헤더에 charset이 있으면 그것을 우선한다
  const ct = res.headers.get('content-type') || '';
  const enc = opt.encoding || (ct.match(/charset=([\w-]+)/i) || [])[1] || 'utf-8';
  if (/^utf-?8$/i.test(enc)) return res.text();

  const buf = await res.arrayBuffer();
  try {
    return new TextDecoder(enc).decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

export const strip = (h) =>
  (h || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

// 판매처가 상품명 앞에 붙이는 이벤트 표식 (같은 앨범인데 SKU가 갈리는 원인)
const EVENT_TOKENS = [
  'Online Lucky Draw Event',
  'Lucky Draw Event',
  'LUCKY DRAW',
  'COMEBACK LIVE',
  'Off-line Sign Event',
  'OFF-LINE SIGN EVENT',
  'Ktown4u Special Gift',
  '케타포 Special Gift', // kr.ktown4u.com 한글판
  '온라인 럭키드로우 이벤트',
  '럭키드로우 이벤트',
  '대면 사인회',
  '영상통화 팬사인회',
  'YouTube',
  'Pre-Order Benefit Event',
  'Pre-Order Special Event',
  'MAGAZINE',
  'MD',
  '수입',
];

/**
 * 상품명을 (event, edition, packaging) 으로 분해한다.
 * 판매처마다 표기가 달라서 이 정규화가 매칭의 전부다.
 */
export function parseTitle(rawTitle) {
  let t = ' ' + (rawTitle || '').replace(/\s+/g, ' ').trim() + ' ';

  // 1) 이벤트 접두어 추출·제거
  const events = [];
  for (const tok of EVENT_TOKENS) {
    const re = new RegExp('\\[\\s*' + tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\]', 'ig');
    if (re.test(t)) {
      events.push(tok);
      t = t.replace(re, ' ');
    }
  }

  // 2) 포장 단위: 세트 / 랜덤 / 단품
  //    세트 "개수"는 매칭 키에서 뺀다 — 위버스샵은 (Set)이라고만 쓰고 개수를 안 적기 때문에
  //    [2종 세트](알라딘) · [2CD 세트상품](Ktown4u) · (Set)(위버스샵)이 같은 칸에 와야 한다.
  let packaging = '단품';
  const setN = t.match(/\[?\s*(\d+)\s*(?:CD\s*)?(?:종\s*)?(?:세트상품|세트|SET)\s*\]?/i);
  const isSet = /\[SET\]|\(\s*Set\s*\)|종\s*세트|CD\s*SET|세트상품|CD\s*세트/i.test(t);
  // "2종 중 1종 랜덤"(사운드웨이브) · "[2종 중 랜덤발송]"(알라딘) · "(Random Ver.)"(위버스/Ktown4u)
  const isRandom = /랜덤\s*발송|중\s*\d*\s*종?\s*랜덤|\(\s*Random(?:\s*Ver\.?)?\s*\)|Random\s*Ver\.?/i.test(t);
  if (isSet) packaging = '세트';
  else if (isRandom) packaging = '랜덤';
  const setCount = isSet && setN ? Number(setN[1]) : null;

  // 포장 관련 토큰 제거
  t = t
    .replace(/\[\s*SET\s*\]/gi, ' ')
    .replace(/\[?\s*\d+\s*(?:CD\s*)?종?\s*(?:중\s*)?(?:랜덤발송|랜덤\s*발송|세트상품|세트|SET)\s*\]?/gi, ' ')
    .replace(/\(\s*Random(?:\s*Ver\.?)?\s*\)/gi, ' ')
    .replace(/\(\s*Set\s*\)/gi, ' ')
    .replace(/\[\s*\d+\s*종\s*중\s*랜덤발송\s*\]/gi, ' ')
    .replace(/랜덤\s*발송/gi, ' ');

  // 3) 에디션: 괄호/대괄호 안에서 'ver' 또는 매체 키워드를 가진 것
  const cands = [];
  for (const m of t.matchAll(/[([]([^()[\]]{1,40})[)\]]/g)) cands.push(m[1].trim());
  let edition = '';
  for (const c of cands) {
    if (/ver\.?$|version$/i.test(c) || /vinyl|LP|일반반|한정반/i.test(c)) {
      edition = c;
      break;
    }
  }
  const editionKey = edition
    ? edition
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/ver\.?$|version$/, '')
        .replace(/[^a-z0-9가-힣]/g, '')
    : '기본';

  // 매칭 키에서는 "단품"과 "랜덤"을 하나로 본다.
  // 위드뮤는 랜덤 표기를 아예 안 쓴다 — "(PHOTO BOOK Ver.)"라고만 적고 실제로는 랜덤 발송이다.
  // 팬의 결정 축도 "세트냐 낱개냐"라서, 낱개는 묶는 편이 맞다. 표시용 packaging은 그대로 둔다.
  const packKey = packaging === '세트' ? '세트' : '개별';

  return {
    events,
    edition: edition || '기본',
    editionKey: editionKey || '기본',
    packaging,
    setCount,
    // 매칭 키 = 에디션 + 포장(세트/개별)
    key: `${editionKey}｜${packKey}`,
  };
}

/** 상품명에서 앨범 제목을 판별 (다른 앨범 혼입 방지) */
export function matchesAlbum(title, albumName) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  return norm(title).includes(norm(albumName));
}
