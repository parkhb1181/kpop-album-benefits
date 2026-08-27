/**
 * 한글 초성 — 검색용.
 *
 * 팬은 `ㅌㅁ`을 치고 태민을 기대한다. 그런데 `ㅌ`(U+314C)과 `태`(U+D0DC)는
 * 코드포인트가 하나도 안 겹쳐서, 문자열을 그대로 비교하는 검색기는 원리상 못 맞춘다
 * (Fuse.js · MiniSearch · Pagefind 전부 마찬가지다).
 *
 * 해결은 라이브러리가 아니라 산술이다. 한글 음절은 U+AC00부터
 * `초성 × 588 + 중성 × 28 + 종성` 으로 규칙적으로 배열돼 있어서, 588로 나누면 초성이 나온다.
 *
 * **초성 변환은 빌드 때 미리 해서 HTML에 박는다.** 그래서 브라우저는 초성 계산을
 * 아예 안 하고 문자열 비교만 한다 — 전송량이 늘지 않고 의존성도 안 생긴다.
 *
 * (es-hangul을 쓸 자리는 따로 있다 — 조사 붙이기나 `ㅌㅐㅁ` 같은 조합 중간 상태.
 *  둘 다 지금 이 사이트에 필요 없다.)
 */

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const BASE = 0xac00;
const LAST = 0xd7a3;

/** "태민 PHASE I" → "ㅌㅁ phase i" (한글이 아닌 글자는 소문자로 그대로 둔다) */
export function choseong(s) {
  let out = '';
  for (const ch of String(s ?? '')) {
    const code = ch.codePointAt(0);
    if (code >= BASE && code <= LAST) out += CHO[Math.floor((code - BASE) / 588)];
    else out += ch.toLowerCase();
  }
  return out;
}

/** 검색 대상 문자열 정규화 — 공백·기호를 지워 "엔시티 127"과 "엔시티127"을 같게 본다 */
export const searchKey = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣ㄱ-ㅎ]/g, '');

/** 질의가 초성만으로 이루어졌는가 (ㅌㅁ) */
export const isChoseongQuery = (q) => /^[ㄱ-ㅎ]+$/.test(searchKey(q));
