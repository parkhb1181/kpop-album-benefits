/**
 * 특전 문구 → 영어 **요약**. 번역이 아니다.
 *
 * ── 왜 번역을 버렸나 ────────────────────────────────────────
 * 규칙 기반 번역을 먼저 만들었다가 폐기했다. 48%가 통과했는데, 통과한 것 중에 이런 게 있었다.
 *
 *   원문   미공개 셀피 포토카드 3종 (5종 중 랜덤)
 *   번역   unreleased selca photocard 3 types (1 of 5, random)
 *
 * **5종 중 3종인데 1종처럼 읽힌다.** 문법은 멀쩡하고 뜻만 틀렸다.
 * 이런 건 원문을 그대로 두는 것보다 나쁘다 — 읽는 사람이 틀린 줄 모른다.
 *
 * 그래서 문장을 옮기지 않고 **품목과 개수만 뽑는다.** 못 뽑으면 null이고,
 * 렌더는 null일 때 한국어 원문을 그대로 보여줘야 한다.
 * 이 사이트가 파는 건 정확도 하나라, 반쯤 맞는 영어보다 못 읽는 한국어가 낫다.
 *
 * 주 독자가 GOM(Group Order Manager, 한국의 총대)이라는 것도 근거다 —
 * 한국 스토어에서 직접 사는 사람들이라 원문을 읽는다.
 *
 * ── 출력 모양 ──────────────────────────────────────────────
 *   { items: [{ what: 'unreleased selca photocard', count: '3 of 5, random' }],
 *     notes: ['per album', 'while supplies last'] }
 *
 * 영어권 `pob list` 포맷이 원래 이렇게 짧다:
 *   • Ktown4u — unreleased photocard, 1 of 2 random
 */

/** 품목. **긴 것부터** 봐야 한다 — `포토카드`가 먼저 걸리면 `미공개 셀피 포토카드`를 놓친다. */
const ITEMS = [
  [/미공개\s*개인컷\s*셀피\s*포토카드/, 'unreleased solo selca photocard'],
  [/미공개\s*유닛\s*셀피\s*포토카드/, 'unreleased unit selca photocard'],
  [/미공개\s*인스턴트\s*포토카드/, 'unreleased instant photocard'],
  [/미공개\s*셀피\s*포토카드/, 'unreleased selca photocard'],
  [/미공개\s*셀카\s*포토카드/, 'unreleased selca photocard'],
  [/미공개\s*포토\s*포토카드/, 'unreleased photocard'],
  [/미공개\s*포토카드/, 'unreleased photocard'],
  [/공개컷\s*필름형\s*포토카드/, 'film-style photocard'],
  [/폴라로이드형\s*포토카드/, 'polaroid-style photocard'],
  [/홀로그램\s*포토카드/, 'hologram photocard'],
  [/인스턴트\s*포토카드/, 'instant photocard'],
  [/단체\s*포토카드/, 'group photocard'],
  [/시크릿\s*포토카드/, 'secret photocard'],
  [/셀피\s*포토카드/, 'selca photocard'],
  [/포토\s*티켓/, 'photo ticket'],
  [/포토카드/, 'photocard'],
  [/리무버블\s*스티커/, 'removable sticker'],
  [/홀로그램\s*엽서/, 'hologram postcard'],
  [/PET\s*북마크/i, 'PET bookmark'],
  [/아크릴\s*보드/, 'acrylic board'],
  [/엽서/, 'postcard'],
  [/포스터/, 'poster'],
  [/스티커/, 'sticker'],
];

/**
 * 개수. 순서가 곧 우선순위다.
 * `5종 중 3종 랜덤`을 `5종 중 랜덤`이 먼저 먹으면 3이 사라진다 — 실제로 그렇게 틀렸었다.
 */
const COUNTS = [
  // 단위가 둘이다 — `6종 중 2종`(종류)과 `6종 중 2장`(장수). 둘 다 "6개 중 2개"라는 뜻이다.
  [/(\d+)\s*종\s*중\s*(\d+)\s*[종장]?\s*랜덤/, (m) => `${m[2]} of ${m[1]}, random`],
  [/(\d+)\s*종\s*중\s*(\d+)\s*[종장]/, (m) => `${m[2]} of ${m[1]}, random`],
  [/(\d+)\s*종\s*\(\s*(\d+)\s*종\s*중\s*랜덤\s*\)/, (m) => `${m[1]} of ${m[2]}, random`],
  [/(\d+)\s*종\s*\/\s*1\s*세트/, (m) => `set of ${m[1]}`],
  [/(\d+)\s*종\s*1\s*세트/, (m) => `set of ${m[1]}`],
  [/(\d+)\s*종\s*세트/, (m) => `set of ${m[1]}`],
  [/(\d+)\s*종\s*중\s*랜덤/, (m) => `1 of ${m[1]}, random`],
  [/(\d+)\s*종/, (m) => (m[1] === '1' ? '1 type' : `${m[1]} types`)],
];

/** 조건. 이걸 놓치면 사용자가 손해를 본다. */
const NOTES = [
  [/초도\s*제작분\s*중\s*일부만/, 'only in part of the first press — not every copy'],
  [/초도\s*중\s*일부/, 'only in part of the first press — not every copy'],
  [/초도\s*한정/, 'first press only'],
  [/각\s*앨범당/, 'per album'],
  [/수량\s*소진\s*시?까지/, 'while supplies last'],
  [/구매\s*수량에\s*맞춰\s*1:1/, 'one per copy purchased'],
  [/증정\s*종료/, 'ended'],
];

/** 럭키드로우는 품목이 아니라 응모권이라 따로 센다 */
const DRAW = /(?:럭키드로우|LUCKY\s*DRAW)\s*참여\s*기회가?\s*(\d+)\s*회/i;

/**
 * 특전 문구에서 **뽑을 수 있는 것만** 뽑는다. 못 뽑으면 null.
 *
 * null이 실패가 아니다 — 억지로 영어를 만들지 않겠다는 뜻이고, 그때는 원문을 보여준다.
 */
export function summarizeBenefit(ko) {
  const src = String(ko ?? '').replace(/\s+/g, ' ').trim();
  if (!src) return null;

  const notes = [];
  for (const [re, en] of NOTES) if (re.test(src) && !notes.includes(en)) notes.push(en);

  const items = [];

  const draw = src.match(DRAW);
  if (draw) items.push({ what: 'lucky draw entries', count: draw[1] });

  // 품목이 여러 개일 수 있다 ("포토카드 A … + 유닛 포토카드 …"). 조각마다 본다.
  // `&`도 품목 구분자다 — `리무버블 스티커 세트(2종/1세트)&포토카드(단체컷 1종)`.
  // 안 나누면 뒤 품목이 앞 품목의 개수를 물고 온다(실제로 그렇게 틀렸다).
  for (const part of src.split(/[+＋&]|그리고|와 함께/)) {
    for (const [re, en] of ITEMS) {
      if (!re.test(part)) continue;
      let count = null;
      for (const [cre, fn] of COUNTS) {
        const m = part.match(cre);
        if (m) {
          count = fn(m);
          break;
        }
      }
      if (!items.some((x) => x.what === en && x.count === count)) items.push({ what: en, count });
      break; // 조각당 품목 하나 — 긴 패턴이 먼저라 가장 구체적인 것이 잡힌다
    }
  }

  if (!items.length && !notes.length) return null;
  return { items, notes };
}

/** 한 줄로 — `unreleased photocard, 1 of 2 random · per album` */
export function benefitLine(ko) {
  const s = summarizeBenefit(ko);
  if (!s) return null;
  const parts = s.items.map((i) => (i.count ? `${i.what}, ${i.count}` : i.what));
  return [parts.join(' + '), ...s.notes].filter(Boolean).join(' · ') || null;
}

/** 사전이 낡는 걸 알아채려고 빌드 로그에 찍는다 */
export function benefitStats(list) {
  let ok = 0;
  for (const b of list || []) if (benefitLine(b)) ok++;
  return { total: (list || []).length, summarized: ok };
}
