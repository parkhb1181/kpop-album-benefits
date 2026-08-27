/**
 * 캘린더 알람 (RFC 5545).
 *
 * 왜 웹푸시가 아니라 캘린더인가 —
 * 이 사이트는 정적 파일이다. 푸시를 하려면 구독 정보를 저장할 DB와, 정해진 시각에
 * 발송할 서버가 필요하다. 1인 운영에서 그건 새 시스템 하나를 더 떠안는 일이다.
 *
 * .ics는 그게 전부 필요 없는데도 결과가 더 낫다:
 *   · 브라우저를 닫아도 알림이 온다 (웹푸시는 iOS에서 홈 화면 설치가 전제다)
 *   · **구독(webcal://)하면 하루 두 번 리빌드마다 캘린더가 알아서 갱신된다.**
 *     마감이 바뀌면 사용자 캘린더의 일정도 따라 바뀐다 — UID를 고정했기 때문이다
 *   · 계정도 이메일 수집도 없다
 */

const pad = (n) => String(n).padStart(2, '0');

/** 2026-08-30T23:59:59+09:00 → 20260830T145959Z */
export function utcStamp(iso) {
  const d = new Date(iso);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** TEXT 값 이스케이프 — 역슬래시·세미콜론·쉼표·줄바꿈 */
const esc = (s) =>
  String(s ?? '')
    .split('\\')
    .join('\\\\')
    .split(';')
    .join('\\;')
    .split(',')
    .join('\\,')
    .replace(/\r?\n/g, '\\n');

/**
 * 75옥텟에서 접는다. 한글은 UTF-8로 3바이트라 글자 수로 세면 규격을 넘는다.
 * 이어지는 줄은 공백 한 칸으로 시작해야 한다.
 */
function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // UTF-8 연속 바이트(10xxxxxx) 한가운데서 자르지 않는다
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push((out.length ? ' ' : '') + bytes.subarray(start, end).toString('utf8'));
    start = end;
    limit = 74; // 이어지는 줄은 앞 공백 한 칸까지 합쳐 75옥텟
  }
  return out.join('\r\n');
}

/**
 * @param {{uid:string,at:string,title:string,desc?:string,url?:string,minutes?:number}} e
 * @param {string} stamp DTSTAMP (UTC)
 */
function vevent(e, stamp) {
  const start = utcStamp(e.at);
  const end = utcStamp(new Date(new Date(e.at).getTime() + (e.minutes ?? 30) * 60000).toISOString());
  const lines = [
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${esc(e.title)}`,
  ];
  if (e.desc) lines.push(`DESCRIPTION:${esc(e.desc)}`);
  if (e.url) lines.push(`URL:${e.url}`);
  // 하루 전과 한 시간 전. 마감 당일에만 알리면 이미 늦는 경우가 있다.
  for (const [trigger, when] of [
    ['-P1D', '하루 전'],
    ['-PT1H', '1시간 전'],
  ]) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `TRIGGER:${trigger}`,
      `DESCRIPTION:${esc(`${e.title} (${when})`)}`,
      'END:VALARM'
    );
  }
  lines.push('END:VEVENT');
  return lines;
}

/** @param {{name:string, events:object[], stamp?:string}} arg */
export function calendar({ name, events, stamp }) {
  const ds = utcStamp(stamp || new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//kpop-album-benefits//KR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`,
    'X-WR-TIMEZONE:Asia/Seoul',
    // 구독자가 얼마나 자주 다시 읽을지. 리빌드가 하루 두 번이라 6시간이면 충분하다.
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    ...events.flatMap((e) => vevent(e, ds)),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** 구글 캘린더 원클릭 추가 링크 — 파일을 안 받고 바로 넣고 싶은 사람용 */
export function googleUrl({ at, title, desc, url, minutes = 30 }) {
  const s = utcStamp(at);
  const e = utcStamp(new Date(new Date(at).getTime() + minutes * 60000).toISOString());
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${s}/${e}`,
    details: [desc, url].filter(Boolean).join('\n'),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}
