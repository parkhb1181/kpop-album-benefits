import { optimize } from './optimize.mjs';
import { metaTags, abs, displayArtist } from './seo.mjs';
import { googleUrl } from './ics.mjs';
import { roughLeft } from './deadlines.mjs';
import { choseong, searchKey } from './hangul.mjs';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

const CSS = `
/* 모티브 — **무채 뼈대 + 커버가 색.**  근거: docs/38-조사-29cm.md
   화면의 절반이 앨범 커버다. 뼈대를 무채로 눌러두면 채도를 가진 건 커버뿐이고,
   컴백마다 사이트 인상이 통째로 바뀐다. 우리가 색을 고를 필요가 없어진다.

   액센트는 하나뿐이고 **경고에만** 쓴다(품절·마감). 긍정 상태는 색이 아니라 굵기로 낸다 —
   그래서 --ok는 초록이 아니라 먹이다. 액센트가 둘이면 어느 쪽도 안 급해 보인다. */
:root{--bg:#fff;--fg:#1a1a1a;--mut:#757575;--dim:#a0a0a0;--line:#e4e4e4;--acc:#c2410c;--ok:#1a1a1a;--card:#f4f4f4}
@media(prefers-color-scheme:dark){:root{--bg:#141416;--fg:#ededf0;--mut:#9a9aa2;--dim:#6f6f78;--line:#2a2a30;--acc:#fb923c;--ok:#ededf0;--card:#1c1c21}}
*{box-sizing:border-box}
body{margin:0 auto;padding:28px 16px 72px;max-width:1080px;background:var(--bg);color:var(--fg);
font:15px/1.6 -apple-system,BlinkMacSystemFont,"Pretendard","Segoe UI",sans-serif}
h2{font-size:15px;margin:34px 0 10px;padding-bottom:8px;border-bottom:1px solid var(--line);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
h3{font-size:13px;color:var(--mut);margin:20px 0 8px;font-weight:600}
.pk{font-weight:500;color:var(--mut);font-size:13px}
.ok{font-size:11px;font-weight:600;color:var(--ok);border:1px solid currentColor;border-radius:99px;padding:1px 8px}
.one{font-size:11px;font-weight:600;color:var(--mut);border:1px solid var(--line);border-radius:99px;padding:1px 8px}
.stamp{color:var(--mut);font-size:13px;margin-bottom:6px}
.sum{background:var(--card);border:1px solid var(--line);border-radius:4px;padding:12px 14px;font-size:13.5px;margin-top:14px}
/* 최저 조합 — 강조는 테두리가 아니라 왼쪽 굵은 선과 글자 굵기로 낸다.
   --ok가 먹이 된 뒤로 여기 테두리가 검은 상자가 돼서 과했다. */
.sum2{background:var(--card);border:0;border-left:3px solid var(--fg);border-radius:0;
padding:12px 14px;font-size:14px;margin-bottom:12px}
.warn{background:var(--card);border:1px solid var(--acc);border-radius:4px;padding:11px 13px;font-size:13.5px;margin-bottom:10px}
.wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13.5px;min-width:640px}
th{text-align:left;color:var(--mut);font-weight:600;font-size:11.5px;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.rt{white-space:nowrap;font-weight:600}
.num{white-space:nowrap;text-align:right}
.ev{font-size:11.5px;color:var(--acc);margin-top:2px}
.ben div{margin-bottom:4px}
.flag{color:var(--acc);font-weight:600}.none{color:var(--mut)}.ok2{color:var(--ok);font-weight:600}
.mut{color:var(--mut);font-size:12px}.q{color:var(--acc);font-weight:700}
a{color:inherit;text-decoration:none;border-bottom:1px solid var(--line)}
a:hover{border-bottom-color:currentColor}
.err{color:var(--acc);font-size:13px;margin-top:28px}
.pol{margin-top:12px;font-size:12px;color:var(--mut);line-height:1.7;background:var(--card);border:1px solid var(--line);border-radius:4px;padding:10px 12px}
.gal{display:flex;gap:14px;overflow-x:auto;padding:4px 0 12px}
.gal figure{margin:0;flex:0 0 190px}
.gal figcaption{font-size:12px;font-weight:700;margin-bottom:6px}
.gal img{width:100%;border:1px solid var(--line);border-radius:4px;display:block;background:var(--card)}
.gal .noimg{width:100%;aspect-ratio:72/152;border:1px dashed var(--line);border-radius:4px;display:flex;flex-direction:column;
align-items:center;justify-content:center;color:var(--mut);font-size:12px;text-align:center;line-height:1.5}
.gal p{font-size:11.5px;color:var(--mut);margin:6px 0 0;line-height:1.5}
td.th{width:52px;padding:8px 4px 8px 8px}
td.th img{width:44px;height:44px;object-fit:cover;border:1px solid var(--line);border-radius:2px;display:block}
.back{font-size:13px;color:var(--mut);display:inline-block;margin-bottom:14px;border:0}
/* ── 상단 헤더 ───────────────────────────────────────────────
   29CM 헤더 실측: 로고 높이 16px · 유틸 간격 16~18px · 라벨 10px · font-extralight.
   **브랜드를 크게 안 외친다.** 얇은 한 줄이고 굵은 선으로 본문과 끊는다.

   우리는 계정·장바구니·카테고리가 없어서 유틸 자리에 넣을 게 없다.
   대신 그 자리에 **신선도(갱신 시각)와 출처(판매처)** 를 놓는다 — 이 사이트의 신뢰가 거기서 온다. */
.hd{margin-bottom:24px}
.hdrow{display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;
padding-bottom:10px;border-bottom:2px solid var(--fg)}
.hd .bd{font-size:12px;font-weight:700;color:var(--fg);white-space:nowrap}
.hd .hdm{font-size:10.5px;color:var(--dim);font-weight:400;text-align:right}
h1{font-size:23px;margin:0 0 8px;letter-spacing:-.015em}
.sub{font-size:13px;color:var(--mut);line-height:1.75;margin:0}
.sub b{color:var(--fg);font-weight:600}

/* ── 인덱스 격자 ─────────────────────────────────────────────
   근거는 docs/38-조사-배치원리.md.

   ⓐ 테두리 상자가 없다. 게슈탈트의 공통 영역(테두리)은 이질적인 것을 한 덩어리로 묶어주지만,
      **똑같은 상자가 격자로 늘어서면 그 상자들이 다시 표의 칸처럼 읽힌다.** 여백이 경계다.
   ⓑ **가로는 좁게, 세로는 넓게.** 한때 가로를 0으로 붙여봤는데 과했다 —
      커버가 흰 배경 상품 사진이라 옆 앨범과 경계가 사라져 어디까지가 한 장인지 모호해졌다.
      29CM 실측 눈금(2·4·6·8·10·12·16·20·24·28·32·40·48·56·60)에서 **가로 16 / 세로 48**을 쓴다.
      가로가 좁아 한 행이 여전히 띠로 읽히고, 세로가 넓어 행 구분은 분명하다.
   ⓒ 칸 최소폭도 넓혔다. 29CM 상품 격자는 auto-fill minmax(261~292px)다 — 우리는 그보다 작은
      정보 단위라 240px. 180px은 글자가 두 줄로 자주 접혀 위계가 무너졌다.
   ⓓ auto-fill이라 브레이크포인트 없이 스스로 접힌다.  */
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:48px 16px;margin-top:24px}
.card{position:relative;min-width:0;border:0;display:block}
.card .go{position:absolute;inset:0;z-index:1}

/* 초점 — 마감이 가장 급한 앨범 하나만 2×2로 병합한다.
   격자는 지키고 딱 한 번 이유를 갖고 깬다. 크기가 곧 "가장 급함"이라는 정보다.
   무작위로 흩는 건 깨는 게 아니라 격자가 없는 것이다 — NN/g 실측상 반무작위 훑기를 부른다. */
.card.f{grid-column:span 2;grid-row:span 2}
/* 열이 하나로 접히는 폭에서만 병합을 푼다(넘침 방지). 배치를 바꾸는 유일한 쿼리다. */
@media(max-width:440px){.card.f{grid-column:span 1;grid-row:auto}}

/* 커버 — 종횡비는 전부 1:1. 크기만 다르고 비율은 안 섞는다.
   비율을 섞으면 행 정렬이 깨지는데, 행 정렬이 격자를 훑을 수 있게 만드는 바로 그것이다.

   **모서리는 직각이다.** 붙여 놓은 이미지에 반경을 주면 맞닿는 자리마다 흰 틈이 생겨
   "붙였다"가 무너진다. 잘린 모서리(clip-path)도 같은 이유로 뺐다 —
   Lando Norris에서 가져왔던 형태인데, 띠를 끊어서 모티브와 부딪힌다. */
.cvw{position:relative;z-index:2;margin-bottom:12px}
.strip{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;
overscroll-behavior-x:contain;background:var(--card)}
.strip::-webkit-scrollbar{display:none}
.strip.multi{cursor:pointer}
.strip img,.strip .ph{flex:0 0 100%;width:100%;aspect-ratio:1;object-fit:cover;display:block;
scroll-snap-align:center;background:var(--card)}
.vn{position:absolute;left:9px;bottom:9px;z-index:3;font-size:10.5px;font-weight:700;
color:#fff;background:rgba(0,0,0,.58);border-radius:99px;padding:1px 8px;pointer-events:none}
.dots{display:flex;gap:5px;margin:-6px 0 10px;position:relative;z-index:2}
.dots button{width:6px;height:6px;padding:0;border:0;border-radius:99px;background:var(--line);cursor:pointer}
.dots button.on{background:var(--fg)}
/* 손가락이 있는 화면에선 스와이프가 더 빠르다. 점은 자리만 먹는다. */
@media (hover:none){.dots{display:none;margin:0}}

/* 위계 3단계 — ①앨범명 ②아티스트 ③메타. 크기·굵기·색 세 지렛대만 쓴다.
   **한글에는 자간을 주지 않는다.** 벌리면 단어 사이 공백이 죽어 "판매처별특 전 비교"로 붙어 읽힌다.
   29CM도 --ruler-scale-letter-spacing: 0 이다. */
.card .ar{font-size:11px;color:var(--mut);font-weight:600;
white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card .al{font-size:15px;font-weight:700;line-height:1.28;margin:5px 0 8px;letter-spacing:-.01em;
display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* 태그 — 29CM 상품 카드 실측을 그대로 옮겼다.
     rounded-2 → 2px · px-4 py-2 → 2·4px · min-h-16 → 16px
     text-xxs-medium → 10px / weight 500 · bg-tertiary + text-secondary → 회색 배경에 회색 글자
   **테두리 알약이 아니다.** 배경으로 채우고 모서리는 거의 직각이다.
   경고(품절)만 액센트를 쓴다 — 나머지가 전부 무채라 그것만 튄다. */
.tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;position:relative;z-index:2}
.tg{display:inline-flex;align-items:center;min-height:16px;padding:2px 4px;border-radius:2px;
font-size:10px;line-height:1.2;font-weight:500;color:var(--mut);background:var(--card);white-space:nowrap}
.tg.w{color:var(--acc);font-weight:700}
.card .meta{font-size:11.5px;color:var(--dim);font-variant-numeric:tabular-nums;line-height:1.55}
.card.f .ar{font-size:12px}
.card.f .al{font-size:28px;line-height:1.16;margin:8px 0 12px;-webkit-line-clamp:3}
.card.f .meta{font-size:13.5px}
.card.f .cvw{margin-bottom:16px}
/* 앨범 상세의 칩. --ok가 먹이 된 뒤로 테두리가 너무 세서 배경 칩으로 바꿨다.
   인덱스 카드는 이 클래스를 안 쓴다 — 거기선 굵기와 액센트로만 낸다(.card .meta). */
.badge{display:inline-block;font-size:10.5px;font-weight:700;color:var(--fg);background:var(--card);
border:0;border-radius:99px;padding:1px 7px;margin-right:5px}
.sold{color:var(--acc);font-weight:700}
.soldb{font-size:11px;font-weight:700;color:var(--acc);border:1px solid currentColor;border-radius:99px;padding:1px 8px}
.chart{font-size:11px;font-weight:600;color:var(--mut);border:1px solid var(--line);border-radius:99px;padding:1px 8px}
.comp{margin-top:10px;border:1px solid var(--line);border-radius:4px;padding:10px 12px;background:var(--card)}
.comp summary{cursor:pointer;font-size:12.5px;font-weight:600;color:var(--mut)}
.comp pre{margin:8px 0 0;font-size:12px;line-height:1.65;white-space:pre-wrap;word-break:break-word;font-family:inherit;color:var(--fg)}
.comp p{margin:8px 0 0}
.cd{font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap}
.cd.urgent{color:var(--acc)}
.cd.over{color:var(--mut);font-weight:400}
.alarm{font-size:12px;white-space:nowrap}
.card .cdl{font-size:11.5px;color:var(--mut);margin-top:6px}
/* 초점 카드에서는 카운트다운이 "왜 이게 큰가"에 답하는 숫자다. 텍스트 위로 올린다. */
.card.f .cdl{order:-1;margin:0 0 10px;font-size:13px;color:var(--acc);font-weight:700}
.card.f{display:flex;flex-direction:column}
.card.f .cvw{order:-3}.card.f .dots{order:-2}
.find{margin-top:14px;display:flex;gap:8px;align-items:center}
.find input{flex:1;min-width:0;padding:10px 12px;font:inherit;font-size:14px;color:var(--fg);
background:var(--card);border:1px solid var(--line);border-radius:4px}
.find input:focus{outline:none;border-color:var(--mut)}
.find .n{font-size:12px;color:var(--mut);white-space:nowrap}
.none-hit{font-size:13.5px;color:var(--mut);margin-top:16px}

/* 모바일 — 네이버 기준 이 카테고리 검색의 93%가 모바일이다 (코르티스 앨범: 모바일 4,730 / PC 360).
   가로 스크롤 표는 그 화면에서 안 읽히므로 행을 카드로 접는다. */
@media(max-width:700px){
  body{padding:18px 12px 56px}
  h1{font-size:20px}
  .wrap{overflow-x:visible}
  table{min-width:0;display:block}
  thead{display:none}
  tbody,tr,td{display:block;width:auto}
  tr{border:1px solid var(--line);border-radius:4px;padding:10px 12px;margin-bottom:10px;background:var(--card)}
  td{border:0;padding:3px 0;display:flex;gap:10px;align-items:baseline}
  td.th{display:none}
  td::before{content:attr(data-label);flex:0 0 62px;color:var(--mut);font-size:11.5px;font-weight:600}
  td:not([data-label])::before{content:none}
  td.num{text-align:left;white-space:normal}
  td.rt{font-size:15px;font-weight:700}
  td.ben{flex-direction:column;gap:3px}
  .gal figure{flex:0 0 150px}
}
`;

/**
 * 카운트다운은 브라우저에서 돈다.
 * 페이지는 하루 두 번만 다시 만들어지지만 data-until이 절대 시각이라,
 * 언제 열어도 맞는다. 서버도 갱신도 필요 없다.
 */
const CD_JS = `<script>
(function(){
function p(n){return n<10?'0'+n:''+n}
function tick(){
var now=Date.now(),els=document.querySelectorAll('.cd'),i,el,t,d,h,m,s;
for(i=0;i<els.length;i++){
el=els[i];t=new Date(el.getAttribute('data-until')).getTime()-now;
if(isNaN(t)){continue}
if(t<=0){el.textContent='마감';el.className='cd over';continue}
d=Math.floor(t/864e5);h=Math.floor(t/36e5)%24;m=Math.floor(t/6e4)%60;s=Math.floor(t/1e3)%60;
el.textContent=(d?d+'일 ':'')+p(h)+':'+p(m)+':'+p(s);
el.className=t<864e5?'cd urgent':'cd';
}
}
tick();setInterval(tick,1000);
})();
</script>`;

/**
 * 초성 검색.
 *
 * 초성 변환은 **빌드 때 끝내서** data-c에 박아뒀다. 그래서 여기서는 문자열 비교만 한다 —
 * 라이브러리도, 자모 분해 코드도 브라우저로 안 내려간다.
 *
 * 질의가 초성만이면(ㅌㅁ) data-c를, 아니면 data-q를 본다.
 * JS가 없으면 검색창을 아예 안 보여준다 — 안 되는 입력창을 두는 것보다 낫다.
 */
const FIND_JS = `<script>
(function(){
var box=document.getElementById('q');if(!box)return;
var wrap=box.parentElement,cnt=document.getElementById('qn'),empty=document.getElementById('qz');
var cards=[].slice.call(document.querySelectorAll('.card'));
wrap.style.display='flex';
function run(){
var v=box.value.toLowerCase().replace(/[^a-z0-9가-힣ㄱ-ㅎ]/g,'');
var jamo=/^[\\u3131-\\u314e]+$/.test(v),n=0,i,el,hit;
for(i=0;i<cards.length;i++){
el=cards[i];
hit=!v||(el.getAttribute(jamo?'data-c':'data-q')||'').indexOf(v)>=0;
el.style.display=hit?'':'none';if(hit)n++;
}
cnt.textContent=v?n+'개':'';
empty.style.display=v&&!n?'':'none';
}
box.addEventListener('input',run);run();
})();
</script>`;

/**
 * 커버 넘기기 — 같은 앨범의 버전별 커버를 훑는다.
 *
 * 장식이 아니라 정보다. 한 앨범이 6~18개 버전으로 갈리고 **버전마다 커버가 다르다** —
 * 이 사이트의 존재 이유가 그거다. 넘겨보면 "이 앨범은 몇 종이고 각각 이렇게 생겼다"가 바로 읽힌다.
 *
 * **손가락은 건드리지 않는다.** scroll-snap만으로 이미 관성 스와이프가 되고,
 * JS로 흉내내면 반드시 더 나빠진다. 마우스에만 클릭·점을 얹는다.
 *
 * 카드 전체가 링크(.go)라, 끌어서 넘긴 뒤 손을 떼면 앨범 페이지로 튀어버린다.
 * 5px 넘게 움직였으면 클릭을 삼킨다.
 */
const COVER_JS = `<script>
(function(){
document.querySelectorAll('.cvw').forEach(function(w){
var strip=w.querySelector('.strip'),tag=w.querySelector('.vn');
var dw=w.parentElement.querySelector('.dots'),dots=dw?dw.querySelectorAll('button'):[];
var imgs=strip.querySelectorAll('img'),n=imgs.length;
if(n<2){if(dw)dw.style.display='none';return}
function at(){return Math.round(strip.scrollLeft/strip.clientWidth)}
function paint(){var i=at(),k;
for(k=0;k<dots.length;k++){dots[k].className=k===i?'on':''}
if(tag){tag.textContent=(i+1)+' / '+n+' · '+(imgs[i].getAttribute('data-v')||'')}}
function go(i){strip.scrollTo({left:strip.clientWidth*((i+n)%n),behavior:'smooth'})}
strip.addEventListener('scroll',paint,{passive:true});
for(var k=0;k<dots.length;k++){(function(k){
dots[k].addEventListener('click',function(e){e.preventDefault();go(k)})})(k)}
var sx=0,moved=0;
strip.addEventListener('pointerdown',function(e){sx=e.clientX;moved=0});
strip.addEventListener('pointermove',function(e){if(e.buttons){var d=Math.abs(e.clientX-sx);if(d>moved)moved=d}});
strip.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(moved<=5)go(at()+1)});
paint();
});
})();
</script>`;

/**
 * 알림 구독 버튼.
 *
 * 캘린더(.ics)와 역할이 다르다 — 캘린더는 **다가오는 마감**을, 푸시는 **없던 게 생긴 것**을
 * 맡는다. 둘 다 보내면 같은 일로 알림이 두 번 온다.
 *
 * 저장하는 건 푸시 엔드포인트 하나뿐이다. 이메일도 계정도 안 받는다.
 * iOS는 홈 화면에 추가해야 웹푸시가 오므로, 그 경우엔 버튼 대신 안내를 낸다.
 */
const pushHtml = (vapidPublicKey) =>
  !vapidPublicKey
    ? ''
    : `<span class="pushwrap" style="display:none"> · <a href="#" id="pushbtn" role="button">새 예판 알림 받기</a>
<span class="mut" id="pushmsg"></span></span>
<script>
(function(){
var KEY=${JSON.stringify(vapidPublicKey)};
var wrap=document.querySelector('.pushwrap'),btn=document.getElementById('pushbtn'),msg=document.getElementById('pushmsg');
if(!wrap)return;
var ok='serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
// iOS는 홈 화면에 추가해야 푸시가 온다. 사파리 탭에서는 버튼이 눌러도 아무 일도 안 난다.
var iosNotInstalled=/iP(hone|ad|od)/.test(navigator.userAgent) && !window.navigator.standalone;
wrap.style.display='';
if(!ok){msg.textContent=' (이 브라우저는 알림을 지원하지 않습니다)';btn.style.display='none';return}
if(iosNotInstalled){msg.textContent=' (아이폰은 공유 → 홈 화면에 추가 후 가능합니다)';btn.style.display='none';return}
function b64(s){var p='='.repeat((4-s.length%4)%4);var r=(s+p).replace(/-/g,'+').replace(/_/g,'/');var b=atob(r);var a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
function say(t){msg.textContent=' '+t}
navigator.serviceWorker.getRegistration().then(function(r){
  if(!r)return;
  return r.pushManager.getSubscription().then(function(s){ if(s){btn.textContent='알림 끄기';btn.dataset.on='1'} });
});
btn.addEventListener('click',function(ev){
  ev.preventDefault();
  say('처리 중…');
  navigator.serviceWorker.register('/sw.js').then(function(reg){
    return reg.pushManager.getSubscription().then(function(sub){
      if(btn.dataset.on==='1'&&sub){
        return fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,unsubscribe:true})})
          .then(function(){return sub.unsubscribe()})
          .then(function(){btn.textContent='새 예판 알림 받기';btn.dataset.on='';say('껐습니다')});
      }
      return Notification.requestPermission().then(function(p){
        if(p!=='granted'){say('브라우저에서 알림이 차단돼 있습니다');return}
        return reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(KEY)}).then(function(ns){
          return fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:ns.endpoint})})
            .then(function(r){return r.json()})
            .then(function(d){ if(d.ok){btn.textContent='알림 끄기';btn.dataset.on='1';say('켰습니다. 새 예판이 뜨면 알려드립니다')} else say(d.error||'실패했습니다') });
        });
      });
    });
  }).catch(function(e){say('실패했습니다: '+e.message)});
});
})();
</script>`;

/**
 * Vercel Web Analytics.
 *
 * GA4·Clarity 대신 이걸 쓴다 — Pro 요금제에 포함이고, 쿠키가 없어 동의 배너가 필요 없고,
 * 스크립트가 훨씬 가볍다. 지금 페이지가 28KB인데 GA4(~50KB)+Clarity(~40KB)를 붙이면 3배가 된다.
 *
 * 지금 알아야 할 건 "검색으로 사람이 오는가" 하나뿐이고 그건 방문수로 충분하다.
 * 세션 리플레이·히트맵(Clarity)은 볼 트래픽이 생긴 뒤에 붙이는 게 맞다.
 *
 * SITE_URL 이 없는 로컬 빌드에는 넣지 않는다 — 로컬에서 연 페이지가 통계를 오염시킨다.
 */
const ANALYTICS = '<script defer src="/_vercel/insights/script.js"></script>';

const shell = (title, body, meta = {}) => {
  const { jsonLd, siteUrl, ...rest } = meta;
  // JSON-LD는 </script>만 escape하면 된다. 나머지는 JSON이 알아서 안전하다.
  const ld = jsonLd
    ? `\n<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
    : '';
  const analytics = process.env.SITE_URL ? `\n${ANALYTICS}` : '';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
${metaTags({ title, ...rest })}${ld}${analytics}
<style>${CSS}</style></head><body>${body}</body></html>`;
};

const won = (n) => (n == null ? '?' : `${n.toLocaleString()}원`);

/** "2026. 8. 27. AM 10:06:57" → "2026.8.27" — 메타 설명에 초 단위는 노이즈다 */
const shortDate = (stamp) =>
  String(stamp ?? '')
    .split(/오전|오후|AM|PM|\d{1,2}:\d{2}/)[0]
    .replace(/\s*\.\s*/g, '.')
    .replace(/[.\s]+$/, '')
    .trim();

/** 특전 상태 — "없음"과 "종료"와 "비공개"와 "확인 못함"은 전부 다른 정보다 */
const STATUS = {
  has: null, // 내용을 표시
  none: '<span class="none">특전 없음</span>',
  ended: '<span class="mut">증정 종료</span>',
  secret: '<span class="flag">특전 있음 · 구성 비공개</span>',
  // 판매처가 상품명에 특전을 달아뒀지만(뮤직플랜트 [특전증정/…], 애플뮤직 [애플특전])
  // 내용은 못 읽은 경우. "특전 없음"과 절대 섞으면 안 된다 — 정반대 정보다.
  listed: '<span class="flag">특전 있음 · 상품명에만 표기</span>',
  unknown: '<span class="mut">확인 못함</span>',
};
const benefitCell = (i) => {
  if ((i.benefit || []).length) return (i.benefit || []).map((b) => `<div>${esc(b).slice(0, 320)}</div>`).join('');
  return STATUS[i.benefitStatus] ?? (i.benefitFlag ? '<span class="flag">특전 있음 (내용 미파싱)</span>' : STATUS.unknown);
};
const money = (i) =>
  i.price == null ? '—' : i.currency === 'USD' ? `$${i.price.toLocaleString()}` : `${i.price.toLocaleString()}원`;

/** 지금 살 수 있는가 — 특전이 "수량 소진시까지"라 이게 결정을 가른다 */
const stockCell = (i) =>
  i.soldOut === true
    ? '<span class="sold">품절</span>'
    : i.soldOut === false
      ? '<span class="ok2">판매중</span>'
      : '<span class="mut">—</span>';

/** 1인 구매 제한 — 버전마다 다르다. 팬싸 응모용 대량 구매에 결정적 */
const limitCell = (i) => (i.maxOrder ? `<b>${i.maxOrder}</b>장` : '<span class="mut">—</span>');

/**
 * 예판이 끝난 앨범.
 *
 * 지우지 않는다 — 검색에는 계속 걸리기 때문이다(`태민 판매처별 특전` 1페이지에 2017년 글이 있다).
 * 다만 낡은 정보를 현재처럼 보여주면 신뢰가 깨지므로 맨 위에 상태를 박는다.
 */
const expiredBanner = (expired, target) =>
  !expired
    ? ''
    : `<div class="warn"><b>예약판매가 끝난 앨범입니다.</b>
아래 특전·재고·가격은 <b>${esc(expired.lastSeen)}</b>에 마지막으로 수집한 내용이고, 지금은 다를 수 있습니다.
${target.deliveryDate ? `발매일 ${esc(target.deliveryDate)}.` : ''}</div>`;

/**
 * 구조화 데이터.
 *
 * 페이지가 "한 앨범의 여러 판매처 상품"이므로 ItemList가 맞다.
 * Product 하나로 뭉치면 가격이 여러 개라 거짓이 된다.
 */
function albumJsonLd({ artistName, target, rows, groups, siteUrl, slug, expired }) {
  const url = slug ? abs(siteUrl, `album/${slug}`) : null;
  const priced = rows.filter((r) => r.price != null && r.currency !== 'USD');
  const items = [...new Set(rows.map((r) => r.retailer))].slice(0, 20).map((rt, n) => {
    const r = rows.find((x) => x.retailer === rt && x.price != null) || rows.find((x) => x.retailer === rt);
    return {
      '@type': 'ListItem',
      position: n + 1,
      name: `${rt} — ${artistName} ${target.album}`,
      url: r?.url || undefined,
    };
  });
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${artistName} 앨범 ${target.album} 판매처별 특전 비교`,
    description: `버전 ${groups.length}종, 판매처 ${new Set(rows.map((r) => r.retailer)).size}곳`,
    url: url || undefined,
    numberOfItems: items.length,
    itemListElement: items,
  };
  if (priced.length && !expired) {
    const prices = priced.map((r) => r.price);
    data.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'KRW',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: priced.length,
    };
  }
  return data;
}

/**
 * FAQ — `{아티스트} 앨범 어디서 사나요` 류 질문형 쿼리를 받는 자리.
 * 실제로 Reddit r/cortis에 같은 질문이 올라오고 검색 1페이지에 뜬다.
 */
function faqHtml({ artistName, album, retailerNames, best, versions }) {
  if (!retailerNames.length) return '';
  const qa = [
    [
      `${artistName} 앨범은 어디서 사야 하나요?`,
      `${retailerNames.join(' · ')}에서 팝니다. <b>상품 가격은 대체로 같고, 판매처마다 주는 특전(미공개 포토카드 등)이 다릅니다.</b> ` +
        `그래서 "어디가 싼가"보다 <b>"어느 특전을 받고 싶은가"</b>로 고르는 게 맞습니다. 위 표에서 판매처별 특전을 비교하세요.`,
    ],
    [
      `${album} 버전은 몇 종인가요?`,
      `현재 <b>${versions}종</b>을 확인했습니다. 버전마다 구성품과 포토카드가 다르고, 판매처 특전은 그 위에 따로 붙습니다.`,
    ],
    best
      ? [
          `전 버전을 다 모으려면 얼마인가요?`,
          `배송비·쿠폰까지 넣은 최저 조합이 <b>${won(best.sum)}</b>입니다. 한 곳에서 다 못 사는 경우가 많아 배송비가 몇 번 붙는지가 총액을 가릅니다.`,
        ]
      : null,
    [
      `특전은 언제까지 주나요?`,
      `대부분 <b>예약판매 기간 내 선착순</b>이고, 수량이 소진되면 조기 종료됩니다. 이 페이지는 하루 두 번 다시 수집하지만, 구매 직전에 판매처 공지를 한 번 더 확인하세요.`,
    ],
  ].filter(Boolean);
  return `<h2>자주 묻는 것</h2>
${qa.map(([q, a]) => `<details class="comp"><summary>${esc(q)}</summary><p>${a}</p></details>`).join('\n')}`;
}

/** 빌드는 GitHub Actions(UTC)에서 돈다. 시간대를 명시하지 않으면 9시간이 틀어진다. */
const kst = (iso, opt = {}) =>
  new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    // 12시간제는 마감 표기에 위험하다. 00:59가 "AM 12:59"로 나와서 정오처럼 읽힌다.
    hour12: false,
    ...opt,
  });

/**
 * 마감 카운트다운.
 *
 * **"오픈까지"가 아니라 "마감까지"다.** 오픈 시각은 어디서도 미리 못 얻는다 —
 * 메이크스타는 열린 뒤에야(ON_SALE) 목록에 넣고, 위버스샵도 판매 중인 것만 준다.
 * 반면 마감은 초 단위로 정확하고, 팬을 실제로 급하게 만드는 쪽도 마감이다.
 */
function countdownHtml(deadlines, slug, siteUrl, subject) {
  if (!deadlines?.length) return '';
  const now = Date.now();
  const rows = deadlines
    .map((d) => {
      // 캘린더에 들어간 뒤에는 앨범명이 없으면 무슨 일정인지 알 수 없다.
      // 부연(note)은 제목이 아니라 설명으로 보낸다.
      const g = googleUrl({
        at: d.at,
        title: [subject, d.label].filter(Boolean).join(' — '),
        desc: d.note,
        url: d.url,
      });
      return `<tr><td class="rt">${esc(d.label)}${d.kind === 'fansign' ? ' <span class="flag">팬싸</span>' : ''}
${d.note ? `<div class="mut">${esc(d.note).slice(0, 90)}</div>` : ''}</td>
<td class="num" data-label="남은 시간"><span class="cd" data-until="${esc(d.at)}">${esc(roughLeft(d.ms - now))}</span></td>
<td class="mut" data-label="시각">${esc(kst(d.at))}</td>
<td class="alarm" data-label="알림"><a href="${esc(g)}" rel="nofollow noopener" target="_blank">구글 캘린더</a></td></tr>`;
    })
    .join('');

  // webcal://은 절대주소여야 한다. SITE_URL이 없으면 구독 안내를 생략한다.
  const feed = siteUrl
    ? ` · <a href="${esc(siteUrl.replace(/^https?:/, 'webcal:'))}/alarm.ics">전체 마감 구독</a>
<span class="mut">(구독하면 하루 두 번 갱신됩니다)</span>`
    : '';

  return `<h2>마감까지 <span class="one">실시간</span></h2>
<div class="wrap"><table><thead><tr><th>무엇</th><th>남은 시간</th><th>시각 (KST)</th><th>알림</th></tr></thead>
<tbody>${rows}</tbody></table></div>
<p class="mut" style="margin-top:8px"><a href="../alarm/${esc(slug)}.ics" download>이 앨범 마감을 캘린더에 넣기 (.ics)</a>${feed}</p>
${CD_JS}`;
}

/**
 * 팬사인회·영상통화 이벤트 — 메이크스타에서만 나온다.
 * 앨범값(1~2만원)보다 훨씬 큰 돈이 걸리는 결정이라 특전보다 위에 놓는다.
 */
function eventsHtml(events, eventTotal) {
  // 진행 중 이벤트 **전량**과 대조하므로, 없다는 것도 이제는 정보다.
  // (예전엔 아티스트명으로 검색했던 탓에 "없음"과 "못 찾음"이 구분되지 않았다)
  const scope = eventTotal
    ? `메이크스타 진행 중 이벤트 ${eventTotal}건을 전부 대조합니다.`
    : '메이크스타 진행 중 이벤트 전량과 대조합니다.';
  const limits = `<div class="pol">${scope}
Ktown4u·위버스샵 등이 자체적으로 여는 이벤트는 아직 잡지 못합니다.
알라딘·사운드웨이브·위드뮤는 팬싸 정보를 아예 제공하지 않습니다.</div>`;

  if (!events?.length) {
    return `<h2>팬사인회 · 이벤트 <span class="one">메이크스타</span></h2>
<p class="mut" style="font-size:13.5px">진행 중인 메이크스타 이벤트에 <b>이 앨범 건은 없습니다.</b></p>
${limits}`;
  }

  const rows = events
    .map((e) => {
      const when = e.closing
        ? '<span class="sold">마감임박</span>'
        : e.dday != null
          ? `<b>D-${e.dday}</b>`
          : '<span class="mut">진행중</span>';
      // 어떤 버전을 얼마에 사야 응모되는지 — 이게 없으면 아래 특전표와 이어지지 않는다
      const opts = (e.options || [])
        .map((o) => `${esc(o.name)} ${o.krw != null ? `<b>${won(o.krw)}</b>` : ''}`)
        .join(' · ');
      const title = e.url ? `<a href="${esc(e.url)}" rel="nofollow">${esc(e.title)}</a>` : esc(e.title);
      return `<tr><td class="rt">${esc(e.label)}${e.fansign ? ' <span class="flag">팬싸</span>' : ''}</td>
<td class="num" data-label="남은 기간">${when}</td>
<td class="mut" data-label="응모 기간">${esc(e.from)} ~ ${esc(e.to)}${e.winnerAt ? `<br>발표 ${esc(e.winnerAt)}` : ''}</td>
<td data-label="이벤트">${title}${opts ? `<div class="mut">응모 가능: ${opts}</div>` : ''}</td></tr>`;
    })
    .join('');

  return `<h2>팬사인회 · 이벤트 <span class="one">메이크스타</span></h2>
<div class="warn">이 이벤트들은 <b>메이크스타에서 그 앨범을 사야 응모됩니다.</b>
다른 판매처에서 산 앨범으로는 응모할 수 없고, 응모 마감 뒤에는 취소·환불이 안 됩니다.</div>
<div class="wrap"><table><thead><tr><th>종류</th><th>남은 기간</th><th>응모 기간</th><th>이벤트</th></tr></thead><tbody>${rows}</tbody></table></div>
${limits}`;
}

export function renderAlbum({
  target,
  rows,
  errors,
  stamp,
  events,
  eventTotal,
  deadlines,
  siteUrl,
  slug,
  artistKo,
  expired,
  ogCard,
}) {
  const byKey = new Map();
  for (const r of rows) {
    if (!byKey.has(r.key)) byKey.set(r.key, []);
    byKey.get(r.key).push(r);
  }
  const groups = [...byKey.entries()].sort((a, b) => {
    const ra = new Set(a[1].map((x) => x.retailer)).size;
    const rb = new Set(b[1].map((x) => x.retailer)).size;
    return rb - ra || b[1].length - a[1].length;
  });

  const sections = groups
    .map(([key, items]) => {
      const [ed, pk] = key.split('｜');
      const retailers = new Set(items.map((x) => x.retailer));
      const badge =
        retailers.size >= 2 ? `<span class="ok">${retailers.size}개 판매처 비교</span>` : `<span class="one">1곳만</span>`;
      // 판매처를 전부 보여준다 — "특전 없음"도 결정에 필요한 정보다
      const noimgLabel = (i) =>
        i.benefitStatus === 'none'
          ? '특전 없음'
          : i.benefitStatus === 'ended'
            ? '증정 종료'
            : i.benefitStatus === 'secret'
              ? '구성 비공개'
              : (i.benefit || []).length
                ? '이미지 없음'
                : '확인 못함';
      const gal = `<div class="gal">${items
        .map(
          (i) => `<figure><figcaption>${esc(i.retailer)}</figcaption>${
            i.benefitImage
              ? `<a href="${esc(i.benefitImage)}" target="_blank" rel="noopener"><img src="${esc(i.benefitImage)}" alt="${esc(i.retailer)} 특전" loading="lazy"></a>`
              : `<div class="noimg">${noimgLabel(i)}<br><span>${(i.benefit || []).length ? '텍스트만 제공' : ''}</span></div>`
          }${(i.benefit || []).length ? `<p>${esc(i.benefit[0]).slice(0, 200)}</p>` : ''}</figure>`
        )
        .join('')}</div>`;
      // data-label은 모바일 카드 레이아웃에서 열 이름으로 쓰인다 (트래픽의 93%가 모바일)
      const tr = items
        .map(
          (i) => `<tr><td class="th">${i.thumb ? `<img src="${esc(i.thumb)}" alt="${esc(i.retailer)} ${esc(target.album)}" loading="lazy">` : ''}</td>
<td class="rt" data-label="판매처">${esc(i.retailer)}</td>
<td data-label="상품"><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a>${
            (i.events || []).length ? `<div class="ev">${(i.events || []).map(esc).join(' · ')}</div>` : ''
          }</td>
<td class="num" data-label="가격">${money(i)}</td>
<td class="num" data-label="재고">${stockCell(i)}</td>
<td class="num" data-label="1인 최대">${limitCell(i)}</td>
<td class="ben" data-label="특전">${benefitCell(i)}</td>
<td class="num" data-label="판매량">${i.sales != null ? i.sales.toLocaleString() : '—'}</td></tr>`
        )
        .join('');

      // 구성품 — 버전 선택의 실제 기준. 위버스샵이 사이즈까지 준다.
      const comp = items.find((i) => i.composition)?.composition;
      const rnd = items.find((i) => i.randomNote)?.randomNote;
      const compHtml = comp
        ? `<details class="comp"><summary>구성품 보기</summary><pre>${esc(comp)}</pre>${rnd ? `<p class="mut">${esc(rnd)}</p>` : ''}</details>`
        : '';

      const anySold = items.some((i) => i.soldOut === true);
      // 판매처명을 h2에 노출한다 — `코르티스 알라딘 특전`처럼 판매처명이 붙은 쿼리가 실제로 있다(자동완성 확인)
      const shops = [...retailers].join(' · ');
      return `<h2>${esc(ed === '기본' ? '기본반' : ed)} <span class="pk">${esc(pk)}</span> ${badge}${
        anySold ? ' <span class="soldb">일부 품절</span>' : ''
      }</h2>
<h3>${esc(shops)} 특전 비교</h3>
${gal}<div class="wrap"><table><thead><tr><th></th><th>판매처</th><th>상품명 / 이벤트</th><th>가격</th><th>재고</th><th>1인 최대</th><th>특전</th><th>판매량</th></tr></thead><tbody>${tr}</tbody></table></div>${compHtml}`;
    })
    .join('\n');

  const opt = optimize(rows);
  let optHtml = '';
  if (opt?.best) {
    const bd = opt.best.breakdown
      .map(
        (b) => `<tr><td class="rt">${esc(b.retailer)}</td><td class="num">${b.count}종</td><td class="num">${won(b.subtotal)}</td>
<td class="num">${b.fee == null ? `<span class="flag">${esc(b.why || '금액 미확인')}</span>` : b.fee === 0 ? '<span class="ok2">무료</span>' : won(b.fee)}${b.unknown ? '<sup class="q">?</sup>' : ''}</td>
<td class="num">${b.coupon ? `<span class="ok2">-${won(b.coupon)}</span>` : '—'}</td>
<td class="mut">${esc([b.why, b.couponWhy].filter(Boolean).join(' · '))}</td></tr>`
      )
      .join('');
    const singleRows = opt.singles
      .map(
        (s) => `<tr><td class="rt">${esc(s.retailer)}</td><td class="num">${s.count}/${opt.versions}종${s.full ? '' : ' <span class="flag">부족</span>'}</td>
<td class="num">${won(s.goods)}</td>
<td class="num">${s.fee == null ? '<span class="flag">금액 미확인</span>' : s.fee === 0 ? '<span class="ok2">무료</span>' : won(s.fee)}</td>
<td class="num">${s.coupon ? `<span class="ok2">-${won(s.coupon)}</span>` : '—'}</td>
<td class="num"><b>${won(s.sum)}</b>${s.unknown ? '<sup class="q">?</sup>' : ''}</td></tr>`
      )
      .join('');
    optHtml = `<h2>전 버전(${opt.versions}종) 모으기 — 합배송·쿠폰 계산</h2>
${
      opt.unbuyable?.length
        ? `<div class="warn"><b>${opt.unbuyable.length}종은 모든 판매처에서 품절</b>이라 계산에서 뺐습니다 —
${esc(opt.unbuyable.map((u) => u.edition || u.key.split('｜')[0]).join(', ')).slice(0, 200)}.
아래 ${opt.versions}종은 지금 살 수 있는 것만 모은 결과입니다.</div>`
        : ''
    }
${opt.anyFull ? '' : `<div class="warn"><b>어느 한 판매처에서도 ${opt.versions}종 전부를 살 수 없습니다.</b> 나눠 사야 하고, 배송비가 몇 번 붙는지가 총액을 가릅니다.</div>`}
<div class="sum2"><b>최저 조합: ${won(opt.best.sum)}</b> — 상품 ${won(opt.best.goods)} + 배송 ${won(opt.best.ship)}${opt.best.coupon ? ` · 쿠폰 받으면 −${won(opt.best.coupon)}` : ''}${opt.best.unknown ? ' <span class="flag">(일부 미확인)</span>' : ''}</div>
<div class="wrap"><table><thead><tr><th>판매처</th><th>담을 수</th><th>상품</th><th>배송비</th><th>쿠폰(받기 필요)</th><th>비고</th></tr></thead><tbody>${bd}</tbody></table></div>
${singleRows ? `<h3>판매처별 커버리지 — 한 곳에서 살 수 있는 범위</h3><div class="wrap"><table><thead><tr><th>판매처</th><th>담을 수</th><th>상품</th><th>배송</th><th>쿠폰</th><th>총액</th></tr></thead><tbody>${singleRows}</tbody></table></div>` : ''}
<div class="pol">배송·쿠폰 근거 — ${Object.entries(opt.policy)
      .map(([k, v]) => `<b>${esc(k)}</b>: ${esc(v.note)}${v.verified ? '' : ' <sup class="q">?</sup>'}`)
      .join(' · ')}<br><span class="q">?</span> 표시는 미확인 추정치입니다.</div>`;
  }

  const multi = groups.filter(([, it]) => new Set(it.map((x) => x.retailer)).size >= 2).length;
  const soldCount = rows.filter((r) => r.soldOut === true).length;
  const chart = rows.some((r) => (r.chart || []).length > 0);

  // 검색은 한글로 오고, 볼륨은 "특전"이 아니라 "앨범"에 있다.
  //   코르티스 앨범 5,090 / 세븐틴 앨범 1,820  vs  앨범 특전 30 / 판매처별 특전 20  (네이버, 최근 30일)
  // 그래서 제목·본문 첫 줄이 "{아티스트} 앨범"으로 시작해야 한다. 특전은 그 안의 내용물이다.
  const artistName = displayArtist(target.artist, artistKo);
  const retailerNames = [...new Set(rows.map((r) => r.retailer))];
  const desc =
    `${artistName} 앨범 ${target.album} 버전 ${groups.length}종의 구성·가격·판매처별 특전을 ` +
    `${retailerNames.slice(0, 4).join('·')}${retailerNames.length > 4 ? ` 등 ${retailerNames.length}곳` : ''}에서 비교합니다.` +
    `${soldCount ? ` 품절 ${soldCount}건.` : ''} ${shortDate(stamp)} 기준.`;
  /**
   * 공유 카드 이미지.
   *
   * 1순위는 우리가 구운 카드(`ogCard`)다 — 커버·판매처 수·버전 수·품절·최저가가 한 장에 담긴다.
   * 그게 없을 때만 판매처 이미지로 폴백한다. 폴백은 세로로 긴 배너라(실측 720×1525)
   * 1.91:1 카드에서 가운데 띠만 잘려 나오고 우리 정보가 하나도 안 담긴다 — 없느니만 못하진 않지만 나쁘다.
   *
   * `ogCard`는 SITE_URL이 있을 때만 채워진다. og:image는 절대주소를 요구하는데,
   * 틀린 도메인을 박느니 판매처 이미지를 쓰는 게 낫기 때문이다(canonical·sitemap과 같은 규칙).
   */
  const ogImage =
    ogCard || rows.find((r) => r.benefitImage)?.benefitImage || rows.find((r) => r.thumb)?.thumb || null;

  return shell(
    `${artistName} 앨범 ${target.album} — 버전·구성·가격·특전 총정리`,
    `<a class="back" href="../index.html">← 전체 컴백</a>
${expiredBanner(expired, target)}
<h1>${esc(artistName)} 앨범 — ${esc(target.album)}</h1>
<div class="stamp">버전별 구성 · 가격 · 판매처별 예약판매 특전 · <b>${esc(stamp)} 기준</b></div>
<div class="sum">수집 <b>${rows.length}</b>개 상품 · 버전 <b>${groups.length}</b>종 · <b>${multi}</b>종은 2개 이상 판매처에서 비교 가능${
      soldCount ? ` · <b class="sold">${soldCount}개 품절</b>` : ''
    }${chart ? `<br><span class="chart">한터·써클 차트 반영</span> <span class="mut">초동 집계에 잡히는 판매처입니다</span>` : ''}</div>
${countdownHtml(deadlines, slug, siteUrl, `${artistName} ${target.album}`)}
${eventsHtml(events, eventTotal)}
${optHtml}
${sections || '<p>수집된 상품이 없습니다.</p>'}
${faqHtml({ artistName, album: target.album, retailerNames, best: opt?.best, versions: groups.length })}
${errors?.length ? `<div class="err">수집 실패: ${errors.map(esc).join(' / ')}</div>` : ''}`,
    {
      description: desc.slice(0, 160),
      canonical: slug ? abs(siteUrl, `album/${slug}`) : null,
      image: ogImage,
      type: 'article',
      jsonLd: albumJsonLd({ artistName, target, rows, groups, siteUrl, slug, expired }),
    }
  );
}

/**
 * 인덱스 카드의 앨범 커버.
 *
 * 판매처 썸네일을 쓴다. `a.ogImage`가 아니다 —
 * 그쪽은 특전 배너를 먼저 집어서 세로로 긴 그림이 온다(실측: 샤이니 1000×7849, NCT 127 1000×6140).
 *
 * 종횡비는 CSS에서 1:1로 고정한다. 비율을 섞으면 행 정렬이 깨지고,
 * 행 정렬이 격자를 훑을 수 있게 만드는 바로 그것이다(docs/38-조사-배치원리.md).
 * 이미지가 늦게 와도 자리가 미리 잡혀 있어 CLS가 안 생긴다.
 *
 * `eager`는 첫 화면에 들어오는 것에만 준다. **LCP 이미지를 lazy로 걸면 손해다** —
 * 브라우저가 나중에 받으라고 알아듣고 가장 큰 그림이 가장 늦게 온다.
 *
 * `a.covers`(버전별 커버 배열)가 있으면 넘길 수 있는 스트립으로, 없으면 `a.cover` 한 장으로 낸다.
 * 스트립은 CSS scroll-snap이라 손가락 스와이프는 JS 없이 된다(COVER_JS는 마우스만 다룬다).
 */
/**
 * 버전 라벨 정리.
 *
 * 키 정규화가 깨진 값이 섞여 들어온다 — `ohitx27shot`(작은따옴표가 `&#x27;`로 escape된 뒤 남은 x27),
 * `unnaturalvergazedverbreak`(여러 버전명이 뭉개짐) 같은 것들. 그걸 그대로 배지에 띄우면 안 된다.
 * **고칠 곳은 여기가 아니라 수집 쪽(fetchx.mjs의 3축 정규화)이다.** 여기서는 못 읽을 값만 감춘다.
 */
const vLabel = (s) => {
  const t = String(s || '').replace(/x27/g, '');
  return !t || t.length > 14 ? '' : t;
};

function coverStrip(a, eager = false) {
  /**
   * **같은 그림은 한 번만.** 버전 키가 달라도 판매처가 같은 사진을 올려두는 경우가 많다 —
   * 실측: 민호 Make it hot은 버전 7개인데 썸네일 4개가 같은 파일(QzJWoi.jpg)이었다.
   * 키로만 거르면 넘겨도 같은 그림이 반복돼서, 넘기기가 정보가 아니라 소음이 된다.
   */
  const seen = new Set();
  const list = (a.covers?.length ? a.covers : a.cover ? [{ url: a.cover }] : [])
    .filter((c) => {
      const u = c.url || c;
      if (!u || seen.has(u)) return false;
      seen.add(u);
      return true;
    })
    .slice(0, 8);
  if (!list.length) return `<div class="cvw"><div class="strip"><div class="ph"></div></div></div>`;
  const imgs = list
    .map(
      (c, i) =>
        `<img src="${esc(c.url || c)}" alt=""${vLabel(c.label) ? ` data-v="${esc(vLabel(c.label))}"` : ''} ${
          eager && i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'
        } decoding="async">`
    )
    .join('');
  const dots =
    list.length > 1
      ? `<div class="dots">${list.map(() => '<button type="button" aria-label="버전"></button>').join('')}</div>`
      : '';
  return `<div class="cvw"><div class="strip${list.length > 1 ? ' multi' : ''}">${imgs}</div><span class="vn"></span></div>${dots}`;
}

export function renderIndex({ albums, stamp, siteUrl, vapidPublicKey }) {
  /**
   * 초점 하나를 고른다 — **마감이 가장 급한 앨범**.
   *
   * 격자를 깨는 건 이 한 장뿐이다. 격자에 맞춘 것과 깬 것의 대비는
   * 격자가 먼저 분명히 서 있을 때만 인지되기 때문이다(docs/38-조사-배치원리.md).
   * 그리고 깨는 데는 이유가 있어야 한다 — 여기서는 **크기가 곧 "가장 급함"이라는 정보**다.
   *
   * 목록 순서도 같은 축(마감 급한 순)으로 맞춘다. 크기와 순서가 다른 축을 가리키면
   * "왜 저게 큰가"에 답이 없어진다.
   */
  const now = Date.now();
  const at = (a) => (a.nextDeadline?.at ? new Date(a.nextDeadline.at).getTime() : Infinity);
  const ordered = [...albums].sort(
    (x, y) => Number(!!x.expired) - Number(!!y.expired) || at(x) - at(y)
  );
  // 마감이 이미 지났거나 없는 앨범을 크게 세우면 근거가 없다. 그럴 땐 초점을 안 만든다.
  const head = ordered[0];
  const feature = head && !head.expired && Number.isFinite(at(head)) && at(head) > now ? head : null;

  // 검색 대상 문자열을 빌드 때 미리 만들어 카드에 박는다 (브라우저는 비교만 한다)
  const hayOf = (a) => [a.artistDisplay, a.artist, a.artistKo, a.album].filter(Boolean).join(' ');
  /**
   * 카드는 링크가 아니라 상자다. 커버 스트립 안에 점(button)이 들어가는데
   * `<a>` 안에 `<button>`을 넣을 수 없어서다. 대신 `.go`가 카드 전체를 덮는다.
   */
  const cards = ordered
    .map((a, i) => {
      const f = a === feature;
      // 태그 — 29CM 상품 카드 방식. 테두리 알약이 아니라 회색 배경 채움이다(실측: radius 2px).
      // 경고(품절)만 액센트를 쓴다 — 액센트가 한 곳뿐이라 그게 바로 눈에 띈다.
      const tg = [
        a.benefitCount ? `<span class="tg">특전 ${a.benefitCount}곳</span>` : '',
        a.fansignCount ? '<span class="tg">팬싸</span>' : '',
        a.soldCount ? `<span class="tg w">품절 ${a.soldCount}</span>` : '',
      ]
        .filter(Boolean)
        .join('');
      return `<div class="card${f ? ' f' : ''}" data-q="${esc(searchKey(hayOf(a)))}" data-c="${esc(
        searchKey(choseong(hayOf(a)))
      )}">
<a class="go" href="album/${esc(a.slug)}.html" aria-label="${esc(`${a.artistDisplay || a.artist} ${a.album}`)}"></a>
${coverStrip(a, i < 3)}
${
  a.nextDeadline
    ? `<div class="cdl">${esc(a.nextDeadline.label)} <span class="cd" data-until="${esc(a.nextDeadline.at)}">${esc(
        a.nextDeadline.rough || ''
      )}</span></div>`
    : ''
}<div class="ar">${esc(a.artistDisplay || a.artist)}</div>
<div class="al">${esc(a.album)}</div>
${tg ? `<div class="tags">${tg}</div>` : ''}<div class="meta">${[
  `${a.versions}종`,
  `판매처 ${a.retailers}`,
  // 마감 카운트다운이 붙는 앨범은 시간 정보가 이미 있다. 없을 때만 발매일을 낸다.
  !a.nextDeadline && a.deliveryDate ? `${esc(a.deliveryDate)} 발매` : '',
]
  .filter(Boolean)
  .join(' · ')}</div>
</div>`;
    })
    .join('');
  const names = albums
    .slice(0, 6)
    .map((a) => a.artistDisplay || a.artist)
    .join(', ');
  const live = albums.filter((a) => !a.expired).length;
  return shell(
    'K-POP 앨범 정보 — 버전·구성·가격·판매처별 특전 비교',
    `<header class="hd">
<div class="hdrow">
<span class="bd">K-POP 앨범 특전 비교</span>
<span class="hdm">${esc(shortDate(stamp))} 갱신</span>
</div>
</header>
<h1>예약판매 중인 K-POP 앨범 — 버전·구성·특전</h1>
<p class="sub">위버스샵 · 알라딘 · Ktown4u · 사운드웨이브 · 위드뮤 · 뮤직플랜트 · 애플뮤직에서 자동으로 모읍니다.
앨범 <b>${live}</b>개가 예약판매 중이고, 같은 앨범이라도 <b>버전마다 구성이 다르고 어디서 사느냐에 따라 받는 포토카드가 다릅니다.</b>${
      albums.some((a) => a.nextDeadline)
        ? ` 마감이 걸린 앨범은 남은 시간이 함께 표시됩니다.<br>${
            siteUrl
              ? `<a href="${esc(siteUrl.replace(/^https?:/, 'webcal:'))}/alarm.ics">전체 마감 캘린더 구독하기</a> <span class="mut">— 캘린더가 알아서 갱신됩니다</span>${pushHtml(vapidPublicKey)}`
              : `<a href="alarm.ics" download>전체 마감 캘린더 내려받기 (.ics)</a>${pushHtml(vapidPublicKey)}`
          }`
        : ''
    }</p>
${
      // 한 화면에 다 들어오면 검색창이 방해만 된다. 카드가 늘어난 뒤에만 낸다.
      albums.length >= 8
        ? `<div class="find" style="display:none">
<input id="q" type="search" placeholder="아티스트·앨범 검색 — 초성도 됩니다 (ㅌㅁ → 태민)" autocomplete="off" spellcheck="false">
<span class="n" id="qn"></span></div>
<p class="none-hit" id="qz" style="display:none">찾는 앨범이 없습니다. 예약판매 중인 것만 올라옵니다.</p>`
        : ''
    }
<div class="cards">${cards}</div>
${albums.some((a) => a.nextDeadline) ? CD_JS : ''}${albums.length >= 8 ? FIND_JS : ''}${
      albums.some((a) => a.covers?.length > 1) ? COVER_JS : ''
    }`,
    {
      description: (
        `예약판매 중인 K-POP 앨범 ${live}개의 버전·구성·가격·판매처별 특전을 자동 수집해 비교합니다. ` +
        `${names ? `${names} 등. ` : ''}${shortDate(stamp)} 기준.`
      ).slice(0, 160),
      canonical: abs(siteUrl, ''),
      image: albums.find((a) => a.ogImage)?.ogImage || null,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'K-POP 앨범 판매처별 특전 비교',
        numberOfItems: albums.length,
        itemListElement: albums.slice(0, 50).map((a, n) => ({
          '@type': 'ListItem',
          position: n + 1,
          name: `${a.artistDisplay || a.artist} 앨범 ${a.album}`,
          url: abs(siteUrl, `album/${a.slug}`) || undefined,
        })),
      },
    }
  );
}
