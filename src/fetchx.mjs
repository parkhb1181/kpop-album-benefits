export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

/**
 * "느린 것"과 "닿지 않는 것"을 가른다.
 *
 * undici는 connect 타임아웃(기본 10초)을 우리 AbortSignal(15초)보다 **먼저** 터뜨린다.
 * 그때 던지는 건 `TypeError: fetch failed`이고, 진짜 원인은 `e.cause`에 들어 있다:
 *
 *   e.name        = TypeError            ← 여기만 보면 절대 못 찾는다
 *   e.cause.name  = ConnectTimeoutError
 *   e.cause.code  = UND_ERR_CONNECT_TIMEOUT
 *
 * 그래서 `e.name === 'TimeoutError'`만 보던 가드가 안 걸렸고, "무응답은 재시도해도
 * 무응답"이라는 바로 아래 규칙과 **정반대로** 3회를 다 썼다.
 * 실측(블랙홀 IP): 한 건이 11.3초가 아니라 **35.7초**를 먹었다 — 3회 × 11.3 + 백오프 3.6.
 * 러너에서 뮤직플랜트가 앨범당 105초(35초 × 질의 3회)였던 게 이것이다.
 */
const UNREACHABLE = new Set([
  'TimeoutError', // AbortSignal.timeout
  'ConnectTimeoutError', // undici — SYN 무응답
  'HeadersTimeoutError',
  'BodyTimeoutError',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'ETIMEDOUT',
]);

/** 에러 자신과 cause를 모두 본다 — fetch는 진짜 원인을 cause에 숨긴다 */
function unreachable(e) {
  for (const x of [e, e?.cause]) {
    if (x && (UNREACHABLE.has(x.name) || UNREACHABLE.has(x.code))) return true;
  }
  return false;
}

/**
 * 호스트별 회로 차단기.
 *
 * 닿지 않는 호스트에 계속 묻는 건 **비용이 앨범 수만큼 곱해진다.** 게다가
 * 되먹임이 있다 — 막히면 결과가 0건이 되고, 0건이면 build.mjs의 searchWide가
 * 폴백 질의를 전부 돌려 앨범당 질의가 1~2회에서 3~7회로 뛴다.
 * 13앨범이면 죽은 몰 하나에 39~91번을 두드리게 되고, 그게 20분 타임아웃이었다.
 *
 * 그래서 연속 3회 연결 실패면 이 빌드 동안 그 호스트를 포기한다.
 * 3회로 잡은 이유 — 앨범 하나가 쓰는 질의 수와 같아서, 한 앨범치 증거는 보고 판단한다.
 * 한 번이라도 응답이 오면 초기화한다 (일시적 흔들림으로 몰을 통째로 버리지 않기 위해).
 *
 * **연속 회수만으로는 부족하다.** 실측에서 이 지연은 상시가 아니라 간헐적이었다
 * (같은 코드로 8분 21초와 27분 43초가 갈렸다). 드문드문 성공하면 연속 카운터가
 * 계속 초기화돼 차단기가 영영 안 걸리고, 앨범마다 30초씩 다시 쌓인다.
 * 그래서 **누적 낭비 시간**에도 상한을 둔다 — 한 호스트가 이 빌드에서 연결 대기로
 * 60초를 태웠으면, 그게 몰려 있든 흩어져 있든 포기한다. 막으려는 건 총 소요 시간이다.
 *
 * **차단은 조용히 하지 않는다.** 호출자가 hostReport()로 읽어 로그와 화면에 남긴다 —
 * "못 긁은 것"이 "안 파는 것"으로 보이면 안 된다.
 */
const DEAD_AFTER = 3;
const DEAD_BUDGET_MS = 60000;
const _fails = new Map();
const _wasted = new Map();
const _dead = new Map();

const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return String(url);
  }
};

/** 이 빌드에서 포기한 호스트 목록 (건너뛴 요청 수와 함께) */
export function hostReport() {
  return [..._dead.entries()].map(([host, skipped]) => ({ host, skipped }));
}

/**
 * @param {string} url
 * @param {{encoding?: string}} [opt] YES24 등 일부 국내몰은 EUC-KR이라 명시가 필요하다
 */
export async function getText(url, opt = {}) {
  /**
   * 타임아웃이 없으면 응답을 안 주는 호스트 하나가 빌드 전체를 멈춘다.
   *
   * 로컬에서는 안 보였다 — 판매처들이 다 응답하니까. GitHub Actions의 클라우드 IP에서는
   * 어딘가가 연결을 조용히 물고만 있었고, fetch가 무한히 기다리다 **45분 잡 타임아웃**에
   * 걸려 빌드 결과를 통째로 날렸다 (run 33037116758·33037232369).
   * 거절(4xx/5xx)은 처리했는데 무응답은 처리하지 않았던 것이다.
   */
  const timeout = opt.timeout ?? 15000;
  const host = hostOf(url);

  // 이미 포기한 호스트면 즉시 끝낸다. 이게 없으면 죽은 몰 하나가 빌드 전체를 곱한다.
  if (_dead.has(host)) {
    _dead.set(host, _dead.get(host) + 1);
    throw new Error(`연결 불가로 건너뜀 (연속 ${DEAD_AFTER}회 실패) — ${host}`);
  }

  const ATTEMPTS = 3;
  const started = Date.now();
  // 알라딘이 연속 요청에 503을 준다. 짧게 물러섰다 다시 시도한다.
  let res = null;
  let lastErr = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      res = await fetch(url, {
        headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8' },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
      });
      lastErr = null;
    } catch (e) {
      lastErr = e;
      res = null;
      // 무응답은 재시도해도 대개 또 무응답이다. 3회를 다 쓰면 요청 하나가 35초를
      // 잡아먹는다 — 재시도는 429·503처럼 "지금은 바쁘다"는 신호에만 쓴다.
      // cause까지 봐야 한다. 위 UNREACHABLE 주석 참고.
      if (unreachable(e)) break;
    }
    if (res && (res.ok || ![429, 503, 502].includes(res.status))) break;
    // 마지막 시도 뒤에는 물러설 이유가 없다 — 그냥 버리는 시간이었다
    if (attempt < ATTEMPTS - 1) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
  }

  if (lastErr) {
    if (unreachable(lastErr)) {
      const n = (_fails.get(host) || 0) + 1;
      const w = (_wasted.get(host) || 0) + (Date.now() - started);
      _fails.set(host, n);
      _wasted.set(host, w);
      if (n >= DEAD_AFTER || w >= DEAD_BUDGET_MS) _dead.set(host, 0);
    } else {
      _fails.set(host, 0);
    }
    // 원인을 cause에서 꺼내 적는다. "fetch failed"만 남으면 다음 사람이 또 못 찾는다.
    const why = lastErr.cause?.name || lastErr.name;
    throw new Error(`${why}: ${lastErr.cause?.message || lastErr.message} — ${url}`);
  }
  // 응답이 왔으면 그 호스트는 살아 있다 — 일시적 흔들림으로 몰을 버리지 않는다
  _fails.set(host, 0);
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

/** 이름 붙은 엔티티. 숫자 엔티티는 아래에서 일반 처리하므로 여기 안 적는다. */
const NAMED = { nbsp: ' ', lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' };

/**
 * 엔티티만 푼다 — 줄바꿈은 건드리지 않는다.
 * 구성품 설명처럼 여러 줄 구조가 의미를 갖는 값에 쓴다 — strip은 줄바꿈을 공백으로 뭉갠다.
 */
export const decodeEntities = (s) =>
  s
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (m, code) => {
      const n = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      // 제어문자와 범위 밖은 원문 그대로 둔다 — 억지로 바꾸면 더 이상해진다
      return Number.isFinite(n) && n > 31 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    })
    .replace(/&(nbsp|lt|gt|quot|apos|amp);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);

/**
 * 태그를 걷어내고 엔티티를 푼다.
 *
 * **숫자 엔티티를 일반 처리한다.** 판매처마다 같은 문자를 다르게 인코딩하기 때문이다.
 * 코르티스 립밤 특전 하나가 Ktown4u `&#x27;` · 사운드웨이브 `&#039;` · 알라딘 `'`
 * 세 갈래로 저장돼 **버전 키가 3개로 쪼개졌고**, 조각마다 "1곳만 판매"라는 틀린
 * 배지가 붙었다. `&#39;` 하나만 하드코딩해서는 이런 변종을 계속 놓친다.
 *
 * **바뀌지 않을 때까지 반복한다.** 사운드웨이브(카페24)는 이미 이스케이프된 제목을
 * 한 번 더 이스케이프해서 내보낸다 — 실측하면 `TUNE &amp;amp; PLAY`다.
 * 한 번만 풀면 `&amp;`가 남아 같은 앨범이 또 갈라진다.
 * 3회로 끊는 건 `&amp;amp;amp;`까지가 현실적인 상한이고, 그 이상은 우리 데이터가
 * 아니라 상대 쪽이 망가진 것이라 더 풀어봐야 의미가 없기 때문이다.
 */
export const strip = (h) => {
  let s = (h || '')
    // 태그만 지우면 <script> **안의 코드가 본문으로 남는다.** 실측 —
    // 알라딘 상세에서 특전 문구가 `알라딘 특전: emEventSwiper; } 이벤트 이벤트 TXT 미니 8집 …`
    // 으로 저장돼 있었다(8건). 주석도 `>`를 품고 있으면 태그 규칙으로 안 지워진다.
    // 위버스는 raw HTML에서 __NEXT_DATA__를 따로 뽑으므로 여기서 지워도 안전하다.
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '');
  for (let i = 0; i < 3; i++) {
    const next = decodeEntities(s);
    if (next === s) break;
    s = next;
  }
  return s.replace(/\s+/g, ' ').trim();
};

/**
 * 특전 문구 뒤에 붙어 온 **남의 것**을 잘라낸다.
 *
 * 특전은 목록 카드에서 정규식으로 긁는데, 문장 끝을 알려주는 마침표가 없다.
 * 그래서 `[^.]{0,120}` 같은 패턴이 다음 상품 블록까지 먹는다. 실측(2026-08-28) —
 *
 *   알라딘      `초도 한정 아크릴 보드(1종) 삽입 [음반] AND2BLE (앤더블) - 미니 1집 … (Gazed ver`
 *   사운드웨이브  `미공개 셀카 포토카드 6종 중 2종 랜덤 추가 증정 Buy Now [럭키드로우] ENHYPEN …`
 *   사운드웨이브  `… 추가 증정 85,200원 96,400원 document`
 *
 * 63건 중 7건(11%)이 이 상태로 **라이브에 나가 있었다.**
 *
 * 가격은 통째로 안 자른다. `50,000원 이상 구매 시` 같은 조건이 진짜 특전 내용일 수 있어서,
 * **끝에 연속으로 붙은 가격만** 걷어낸다(상품 카드의 정가·판매가 쌍이 그 모양이다).
 */
const BENEFIT_STOP =
  /(\[음반\]|\[DVD\]|\[블루레이\]|Buy Now|장바구니|바로구매|보관함|마이리스트|매장판매중|매장새상품|알라딘 중고|판매자 중고|우주점|지역변경|양탄자배송|세일즈포인트|마일리지|document\b|function\s*\()/;

export function clipBenefit(s) {
  const t = String(s ?? '').replace(/\s+/g, ' ');
  const i = t.search(BENEFIT_STOP);
  return (i >= 0 ? t.slice(0, i) : t)
    .replace(/(\s*[\d,]{4,}\s*원){2,}\s*$/, '') // 끝에 붙은 정가·판매가 쌍
    .replace(/[\s·,\-–—([]+$/, '') // 열린 채 끊긴 괄호·구두점
    .trim();
}

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
  // 대괄호 안 어디에든 "세트"가 있으면 세트다. 뮤직플랜트·애플뮤직이 개수 없이
  // [세트] · [세트/앨범2종] · [특전증정/세트]로만 적어서, 개수를 요구하던 규칙에 안 걸렸다.
  // 세트가 낱개로 분류되면 서로 다른 상품이 같은 비교 행에 섞인다.
  const isSet = /\[SET\]|\(\s*Set\s*\)|종\s*세트|CD\s*SET|세트상품|CD\s*세트|\[[^\][]{0,14}세트[^\][]{0,14}\]/i.test(t);
  // "2종 중 1종 랜덤"(사운드웨이브) · "[2종 중 랜덤발송]"(알라딘) · "(Random Ver.)"(위버스/Ktown4u)
  const isRandom = /랜덤\s*발송|중\s*\d*\s*종?\s*랜덤|\(\s*Random(?:\s*Ver\.?)?\s*\)|Random\s*Ver\.?/i.test(t);
  if (isSet) packaging = '세트';
  else if (isRandom) packaging = '랜덤';
  const setCount = isSet && setN ? Number(setN[1]) : null;

  // 포장 관련 토큰 제거
  t = t
    .replace(/\[\s*SET\s*\]/gi, ' ')
    .replace(/\[[^\][]{0,14}세트[^\][]{0,14}\]/gi, ' ')
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

/**
 * 상품명에서 앨범 제목을 판별 (다른 앨범 혼입 방지).
 *
 * 낱말 경계를 지킨다. 공백까지 지우고 포함만 보면 남의 앨범이 끌려온다 —
 * 실측(536건)에서 이런 것들이 통과하고 있었다:
 *   HEAT  → 원어스 [BLOOD MOON] (THEATRE ver.) · DREAM THEATER 15집 · 아이즈원 [ONEIRIC THEATER]
 *   CLICK → ITZY (CAKE CLICKER KEYRING Ver.) · 도경수 (WAH CLICKER KEYCHAIN)
 * 지수 CLICK 페이지에 ITZY 상품이 같이 놓여 있었다는 뜻이다.
 */
export function matchesAlbum(title, albumName) {
  const soft = (s) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, ' ')
      .trim();
  const hay = soft(title);
  const needle = soft(albumName);
  if (!needle) return false;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) {
    const okStart = i === 0 || hay[i - 1] === ' ';
    const okEnd = i + needle.length === hay.length || hay[i + needle.length] === ' ';
    if (okStart && okEnd) return true;
  }
  return false;
}

/**
 * 기호·공백을 전부 지운 헐거운 비교.
 *
 * 판매처가 앨범명을 붙여 쓰거나(`PHOTOBOOK` vs `PHOTO BOOK`) 다르게 끊으면
 * 엄격한 쪽이 통째로 0건을 내놓는다. **엄격한 쪽이 0건일 때만** 이걸로 되돌린다.
 */
export function matchesAlbumLoose(title, albumName) {
  const norm = (s) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '');
  const n = norm(albumName);
  return Boolean(n) && norm(title).includes(n);
}
