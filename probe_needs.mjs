// 더쿠 아티스트 채널 게시글 제목을 모아 "앨범 구매 주변에서 무엇을 묻는가"를 센다
import { getText, strip } from './src/fetchx.mjs';

const CHANNELS = [
  'enhypen', 'lesserafim', 'txt', 'nct', 'seventeen', 'ive', 'aespa',
  'straykids', 'illit', 'riize', 'zerobaseone', 'nmixx', 'shinee', 'day6',
];

const titles = [];
for (const ch of CHANNELS) {
  for (const page of [1, 2, 3]) {
    try {
      const html = await getText(`https://theqoo.net/${ch}?page=${page}`);
      // <td class="title"><a href="/ch/12345" ...>제목</a>
      for (const m of html.matchAll(/<td[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]{0,400}?)<\/td>/g)) {
        const a = m[1].match(/<a[^>]*>([\s\S]{0,200}?)<\/a>/);
        if (!a) continue;
        const t = strip(a[1]);
        if (t && t.length > 3 && !/^\d+$/.test(t)) titles.push({ ch, t });
      }
    } catch (e) {
      /* 채널이 없을 수 있다 */
    }
  }
}

console.log(`수집 제목 ${titles.length}개 (${CHANNELS.length}개 채널)\n`);

// 주제 분류 — 앨범 구매 주변에서 반복되는 말들
const THEMES = [
  ['특전/미공포', /특전|미공포|포카|포토카드|럭드|럭키드로우/],
  ['예판/구매처', /예판|예약\s*판매|구매처|판매처|어디서\s*사|공구|공동구매/],
  ['팬싸/응모', /팬싸|팬사인|사인회|영통|영상통화|응모|당첨|커트|컷/],
  ['배송/합배송', /배송|합배송|반택|택배|출고|도착/],
  ['초동/차트', /초동|차트|한터|써클|판매량|음판|음반\s*판매/],
  ['교환/양도', /교환|양도|팔아|삽니다|구해|나눔/],
  ['앨범 구성', /구성품|버전|언박싱|개봉|퀄리티|하자|불량/],
  ['시세/가격', /시세|가격|얼마|최저가|할인|쿠폰/],
];

const counts = {};
const examples = {};
for (const { ch, t } of titles) {
  for (const [name, re] of THEMES) {
    if (re.test(t)) {
      counts[name] = (counts[name] || 0) + 1;
      (examples[name] ??= []).push(`[${ch}] ${t}`);
    }
  }
}

for (const [name] of THEMES) {
  const c = counts[name] || 0;
  if (!c) continue;
  console.log(`■ ${name} — ${c}건 (${((c / titles.length) * 100).toFixed(1)}%)`);
  [...new Set(examples[name])].slice(0, 6).forEach((e) => console.log('   ·', e.slice(0, 90)));
  console.log('');
}
