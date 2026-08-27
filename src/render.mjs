import { optimize } from './optimize.mjs';
import { metaTags, abs, displayArtist } from './seo.mjs';
import { googleUrl } from './ics.mjs';
import { roughLeft } from './deadlines.mjs';
import { choseong, searchKey } from './hangul.mjs';
import { feeFor } from './shipping.mjs';

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
   그래서 --ok는 초록이 아니라 먹이다. 액센트가 둘이면 어느 쪽도 안 급해 보인다.

   **다크모드는 두지 않는다.** 배경은 항상 흰색이다.
   커버가 화면의 색을 담당하는 구조라 바닥이 어두워지면 그 전제가 흔들리고,
   흰 배경 상품 사진들이 검은 바닥 위에 뜬 흰 사각형으로 보인다. 29CM도 경쟁사도 다크모드가 없다. */
:root{--bg:#fff;--fg:#1a1a1a;--mut:#757575;--dim:#a0a0a0;--line:#e4e4e4;--acc:#c2410c;--ok:#1a1a1a;--card:#f4f4f4}
html{color-scheme:light}
*{box-sizing:border-box}
body{margin:0 auto;padding:24px 24px 72px;max-width:880px;background:var(--bg);color:var(--fg);
font:16px/1.6 -apple-system,BlinkMacSystemFont,"Pretendard","Segoe UI",sans-serif}
h2{font-size:16px;margin:32px 0 8px;padding-bottom:8px;border-bottom:1px solid var(--line);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
h3{font-size:14px;color:var(--mut);margin:24px 0 8px;font-weight:600}
.pk{font-weight:500;color:var(--mut);font-size:14px}
.ok{display:inline-flex;align-items:center;min-height:16px;font-size:11px;font-weight:500;color:var(--fg);background:var(--card);border:0;border-radius:2px;padding:2px 4px}
.one{display:inline-flex;align-items:center;min-height:16px;font-size:11px;font-weight:500;color:var(--mut);background:var(--card);border:0;border-radius:2px;padding:2px 4px}
.stamp{color:var(--mut);font-size:14px;margin-bottom:8px}
.sum{background:none;border:0;border-top:1px solid var(--line);border-radius:0;padding:12px 0 0;font-size:14px;margin-top:16px;color:var(--mut)}
/* 최저 조합 — 강조는 테두리가 아니라 왼쪽 굵은 선과 글자 굵기로 낸다.
   --ok가 먹이 된 뒤로 여기 테두리가 검은 상자가 돼서 과했다. */
/* 최저가 조합 요약 — 한 줄 박스. 금액이 판단 기준이라 그것만 크게 두고
   내역은 같은 줄 오른쪽 끝으로 민다. */
.best{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;
border:2px solid var(--fg);padding:12px 14px;margin-bottom:clamp(16px,2vw,24px)}
.best .bl{font-size:12px;font-weight:700;color:var(--mut)}
.best .bv{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums}
.best .bm{font-size:12px;color:var(--mut);margin-left:auto;font-variant-numeric:tabular-nums}
.sum2{background:var(--card);border:0;border-left:2px solid var(--fg);border-radius:0;
padding:12px 16px;font-size:14px;margin-bottom:12px}
.warn{background:none;border:0;border-left:2px solid var(--acc);border-radius:0;padding:4px 0 4px 12px;font-size:14px;margin-bottom:12px}
.wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:14px;min-width:640px}
th{text-align:left;color:var(--mut);font-weight:600;font-size:12px;padding:8px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:8px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.rt{white-space:nowrap;font-weight:600}
.num{white-space:nowrap;text-align:right}
.ev{font-size:12px;color:var(--acc);margin-top:2px}
.ben div{margin-bottom:4px}
.flag{color:var(--acc);font-weight:600}.none{color:var(--mut)}.ok2{color:var(--ok);font-weight:600}
.mut{color:var(--mut);font-size:12px}.q{color:var(--acc);font-weight:700}
.est{font-size:11px;font-weight:600;color:var(--acc);white-space:nowrap;margin-left:4px}
/* 오른쪽 정렬 칸에서 배지를 이어 붙이면 숫자가 그만큼 밀려 세로줄이 어긋난다. 밑줄로 내린다. */
.num .est,.num .flag.sub{display:block;margin:2px 0 0}
.bds .dl:first-child{border-top:2px solid var(--fg)}
a{color:inherit;text-decoration:none;border-bottom:1px solid var(--line)}
a:hover{border-bottom-color:currentColor}
.err{color:var(--acc);font-size:14px;margin-top:24px}
.pol{margin-top:12px;font-size:12px;color:var(--dim);line-height:1.7;background:none;border:0;border-top:1px solid var(--line);border-radius:0;padding:12px 0 0}
.gal{display:flex;gap:16px;overflow-x:auto;padding:4px 0 12px}
.gal figure{margin:0;flex:0 0 190px}
/* 구성품 시트는 치수·랜덤 확률이 글씨로 적혀 있다. 190px에선 안 읽힌다. */
.gal figure.wide{flex:0 0 300px}
.rep{margin:2px 0 12px;font-size:12px}
.rep a{font-weight:600}
.rep .mut{margin-left:6px}
/* 페이지 갤러리 — 메인 한 장 + 썸네일 줄. */
.pgal{position:relative;margin:0 0 clamp(28px,3.4vw,44px)}
.pgm{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}
.pgm::-webkit-scrollbar{display:none}
.pgm figure{margin:0;flex:0 0 100%;scroll-snap-align:start;min-width:0}
/* 구성품 시트는 세로로 길어서 비율만 잡으면 화면을 다 잡아먹는다. 높이를 묶는다. */
.pgm img{width:100%;height:clamp(340px,58vh,540px);object-fit:contain;background:var(--card);display:block}
/* 판매처 상세 이미지는 세로로 아주 길다(위버스샵 1000×6140). 통째로 칸에 넣으면
   폭이 88px이라 안 읽히고, 지우면 특전 자료의 81%가 날아간다. 칸 안에서 넘겨 본다. */
.pgm figure.tall a{display:block;height:clamp(340px,58vh,540px);overflow-y:auto;background:var(--card)}
.pgm figure.tall img{height:auto;object-fit:unset}
.scr{font-size:11px;font-weight:600;color:var(--acc)}
.pgm figcaption{font-size:12px;font-weight:700;margin-top:8px}
.pgm figcaption span{display:block;font-weight:400;color:var(--mut);margin-top:2px}
.pgt{display:flex;gap:6px;overflow-x:auto;margin-top:12px;scrollbar-width:thin}
.pgt button{flex:0 0 auto;width:52px;height:52px;padding:0;cursor:pointer;
border:1px solid var(--line);background:var(--card)}
.pgt button[aria-current=true]{border:2px solid var(--fg)}
.pgt img{width:100%;height:100%;object-fit:cover;display:block}
.gnav{position:absolute;z-index:2;width:34px;height:34px;border:0;border-radius:2px;
background:rgba(0,0,0,.62);color:#fff;font-size:17px;line-height:1;cursor:pointer;display:none}
.pgal[data-gal] .gnav{display:block}
.gnav.p{left:0}.gnav.n{right:0}
.gal img{width:100%;border:0;border-radius:0;display:block;background:var(--card)}
.gal p{font-size:12px;color:var(--mut);margin:8px 0 0;line-height:1.5}
td.th{width:52px;padding:8px 4px 8px 8px}
td.th img{width:44px;height:44px;object-fit:cover;border:1px solid var(--line);border-radius:2px;display:block}
.back{font-size:14px;color:var(--mut);display:inline-block;margin-bottom:16px;border:0}

/* 상단 — 앨범 커버와 마감을 나란히.
   가로로 긴 표에 두 줄을 넣으면 여백만 남는다. 커버를 크게 두는 게 이 페이지의 주인공이기도 하다. */
/* 커버는 왼쪽 400px 고정, 마감은 오른쪽 세로 스택.
   가로 그리드로 늘어놓으면 2px 규칙이 첫 칸에만 빠져 좌우가 어긋난다(실제로 그렇게 보였다).
   세로로 쌓으면 그 규칙이 **구분선**으로 읽혀서 첫 항목만 없는 게 맞는 모양이 된다. */
.hero{display:flex;gap:clamp(20px,3vw,36px);align-items:flex-start;flex-wrap:wrap;
margin-bottom:clamp(28px,3.4vw,44px)}
.hcv{width:400px;height:400px;object-fit:cover;display:block;background:var(--card);flex:0 0 auto}
.dls{display:flex;flex-direction:column;gap:16px}
/* 조합 내역은 서로 견주는 항목이라 가로로 늘어놓는다. 세로로 쌓으면 한 줄에 하나씩
   읽히면서 "어디서 몇 종"이 서로 멀어진다. */
.bds{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:clamp(12px,1.6vw,20px)}
.hero .dls{flex:1 1 260px;min-width:0}
.dl{border-top:2px solid var(--fg);padding-top:10px}
.dlt{font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px}
.dlc{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;margin:4px 0 2px}
.dlm{font-size:12px;color:var(--mut)}
.dlm a{border:0}
.dlb{font-size:14px;line-height:1.7;margin-top:8px}
.dls .dl:first-child{border-top:0;padding-top:0}
@media(max-width:760px){.hcv{width:100%;height:auto;aspect-ratio:1}}

/* ── 버전 탭 ─────────────────────────────────────────────────
   버전 6~18종을 세로로 쌓으면 페이지가 한없이 길어지는데 팬은 보통 한 버전만 본다.
   선택지는 드롭다운에 감추지 말고 **전부 보이는 버튼**으로 내놓는다(NN/g: 선택 15~20% 상승).
   JS가 없으면 전부 펼쳐진다 — 탭은 덧붙이는 것이지 전제가 아니다. */
.vtabs{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 clamp(16px,2vw,24px)}
.vt{font:inherit;font-size:12px;font-weight:600;color:var(--mut);background:var(--card);
border:0;border-radius:2px;padding:8px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.vt:hover{color:var(--fg)}
.vt.on{color:var(--bg);background:var(--fg)}
.vtp{font-weight:400;opacity:.7}
.vtd{font-size:11px;font-weight:700;color:var(--acc)}
.vt.on .vtd{color:var(--bg);opacity:.75}
.vp+.vp{margin-top:clamp(32px,4vw,56px)}
.vp>h3,.pp>h3{margin-top:0}

/* 포장(낱개·세트) — 버전을 고른 다음에 정하는 문제라 탭 안에 둔다. */
.psw{display:flex;gap:4px;margin:0 0 16px}
.pb{font:inherit;font-size:12px;font-weight:600;color:var(--mut);background:none;
border:1px solid var(--line);border-radius:2px;padding:4px 12px;cursor:pointer}
.pb.on{color:var(--fg);border-color:var(--fg)}

/* ── 판매처 카드 (Pangram Pangram 구조 번역) ────────────────
   특전이 표 한 칸의 긴 문장이면 판매처끼리 비교가 안 된다 — 비교하려고 만든 페이지인데.
   그래서 판매처를 카드로 세우고 **특전을 카드 본문**으로 올린다.
   간격은 clamp로 유동이다(PP 방식). 넓은 화면에서 답답하지 않고 좁은 화면에서 안 터진다. */
.vsw{display:flex;gap:4px;margin:0 0 12px}
.vb{font:inherit;font-size:11px;font-weight:600;color:var(--mut);background:none;
border:1px solid var(--line);border-radius:2px;padding:3px 10px;cursor:pointer}
.vb.on{color:var(--bg);background:var(--fg);border-color:var(--fg)}
/* 열 폭을 내용에 맡기면 탭을 옮길 때마다 열이 통째로 움직인다.
   실측: PHOTO BOOK [117,70,645] vs JEWEL [289,172,371] — 가격 열이 171px 뛴다. */
.cmp.fx{table-layout:fixed}
.cmp.fx .c1{width:170px}
.cmp.fx .c2{width:112px}
.cmp.fx .c3{width:96px}
/* 가격은 오른쪽 정렬이라 숫자 끝이 특전 첫 글자에 붙는다. 특전 칸 왼쪽을 띄운다. */
.cmp.fx td.ben,.cmp.fx th:last-child{padding-left:24px}
.cmp .rt{font-weight:700}
.rt a,.rt{align-items:center}
.rt a{display:inline-flex;gap:6px;align-items:center}
.rlg{display:inline-block;width:18px;height:18px;flex:0 0 auto;border-radius:2px;vertical-align:-4px;background:center/contain no-repeat}
.rlg.mono{display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;
color:var(--mut);background:var(--card);border-radius:2px}
.cmp.fx td.rt{white-space:nowrap}
/* 이벤트 제목은 길다 — 줄바꿈을 막으면 375px 화면에서 문서가 685px로 늘어난다(실측). */
.evt{font-weight:600;word-break:keep-all}
.cmp .tags{margin:4px 0 0}
.cmp .rt .tg{white-space:normal;word-break:keep-all}
a.tg{border-bottom:0}
a.tg:hover{color:var(--fg);background:var(--line)}
.cmp td.ben{word-break:keep-all}
.scs{display:grid;grid-template-columns:repeat(auto-fill,minmax(clamp(220px,24vw,300px),1fr));
gap:clamp(12px,1.4vw,20px);margin-bottom:clamp(20px,2.4vw,32px)}
.sc{display:flex;flex-direction:column;min-width:0;border-top:2px solid var(--fg);padding-top:10px}
.sch{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.scn{font-size:14px;font-weight:700}
.scp{font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.sc .tags{margin:8px 0 0}
/* 특전이 이 카드의 주인공이다. 표 칸이 아니라 본문 크기로 읽힌다. */
.scb{font-size:14px;line-height:1.7;margin:10px 0 12px;flex:1;word-break:keep-all}
.scb div{margin-bottom:6px}
.scl{font-size:12px;color:var(--mut);border:0;margin-top:auto}
.scl:hover{color:var(--fg)}

/* ── 문서 구조 (나무위키식) ─────────────────────────────────
   개요 → 목차 → 번호 매긴 문단 → 각주.
   표가 10개 넘게 쌓이는 페이지라 목차가 유일한 항해 수단이다. */
.lead{font-size:16px;line-height:1.85;margin:0 0 24px;max-width:70ch}
.lead b{font-weight:600}
.toc{border:1px solid var(--line);padding:12px 16px;margin:0 0 32px;display:inline-block;min-width:280px;max-width:100%}
.toc>b{display:block;font-size:12px;color:var(--mut);margin-bottom:8px}
.toc ol{list-style:none;margin:0;padding:0;font-size:14px;line-height:1.9}
.toc a{border:0;color:var(--fg)}
.toc a:hover{text-decoration:underline}
.sn{color:var(--dim);font-variant-numeric:tabular-nums;margin-right:2px}
h2:target,section:target{scroll-margin-top:16px}

/* 각주 — 우리 데이터는 88%가 불확실하다. 감추는 대신 왜 모르는지를 여기 적는다. */
.fnr{font-size:11px;font-weight:600;line-height:0}
.fnr a{border:0;color:var(--acc)}
.fns{margin-top:48px;border-top:2px solid var(--fg);padding-top:16px}
.fns h2{border:0;margin:0 0 8px;padding:0;font-size:12px;color:var(--mut)}
.fns ol{margin:0;padding-left:20px;font-size:12px;color:var(--mut);line-height:1.8}
.fns li{scroll-margin-top:16px}
.fns li b{color:var(--fg)}
.fns .bk{border:0;color:var(--dim);margin-right:4px}
/* ── 상단 헤더 ───────────────────────────────────────────────
   29CM 헤더 실측: 로고 높이 16px · 유틸 간격 16~18px · 라벨 10px · font-extralight.
   **브랜드를 크게 안 외친다.** 얇은 한 줄이고 굵은 선으로 본문과 끊는다.

   우리는 계정·장바구니·카테고리가 없어서 유틸 자리에 넣을 게 없다.
   대신 그 자리에 **신선도(갱신 시각)와 출처(판매처)** 를 놓는다 — 이 사이트의 신뢰가 거기서 온다. */
.hd{margin-bottom:24px}
.hdrow{display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;
padding-bottom:8px;border-bottom:2px solid var(--fg)}
/* 브랜드 줄이 곧 h1이다. 별도 제목 줄을 두면 같은 말을 두 번 하게 된다 —
   "K-POP 앨범 특전 비교"와 "예약판매 중인 K-POP 앨범 …"이 정확히 그랬다.
   h1은 크기가 아니라 **존재**가 검색 신호라, 12px이어도 제 역할을 한다. */
/* 마스트헤드 — 로고 + 이름 + 설명구. 브랜드와 키워드를 한 줄에 같이 세운다.
   이름만 두면 검색이 약해지고, 설명만 두면 이름이 없다. 신문 제호가 쓰는 방식이다. */
.brand{display:flex;align-items:baseline;gap:8px;margin:0;border:0;flex-wrap:wrap}
.brand .lg{align-self:center;display:block;flex:0 0 auto}
.hd .bd{font-family:"Noto Sans KR",-apple-system,BlinkMacSystemFont,"Pretendard","Segoe UI",sans-serif;
font-size:20px;font-weight:800;color:var(--fg);white-space:nowrap;letter-spacing:-.03em}
.hd .tl{font-size:14px;color:var(--mut);white-space:nowrap}
.hd .hdm{font-size:12px;color:var(--dim);white-space:nowrap}

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
/* 카드를 덮는 투명 링크. 전역 a{border-bottom}을 반드시 꺼야 한다 —
   안 끄면 그 밑줄이 **카드 바닥 모서리**에 그려지고, 카드마다 높이가 달라
   텍스트와 선 사이 간격이 제각각으로 보인다. */
.card .go{position:absolute;inset:0;z-index:1;border:0}

/* 커버 — 종횡비는 전부 1:1. 크기만 다르고 비율은 안 섞는다.
   비율을 섞으면 행 정렬이 깨지는데, 행 정렬이 격자를 훑을 수 있게 만드는 바로 그것이다.

   **모서리는 직각이다.** 붙여 놓은 이미지에 반경을 주면 맞닿는 자리마다 흰 틈이 생겨
   "붙였다"가 무너진다. 잘린 모서리(clip-path)도 같은 이유로 뺐다 —
   Lando Norris에서 가져왔던 형태인데, 띠를 끊어서 모티브와 부딪힌다. */
.cvw{position:relative;z-index:2;margin-bottom:12px}
.strip{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;
overscroll-behavior-x:contain;background:var(--card)}
.strip::-webkit-scrollbar{display:none}
/* 커버는 전부 앨범 페이지로 가는 링크다. 버전이 여럿이든 아니든 커서는 손가락이다. */
.strip{cursor:pointer}
.strip img,.strip .ph{flex:0 0 100%;width:100%;aspect-ratio:1;object-fit:cover;display:block;
scroll-snap-align:center;background:var(--card)}
.vn{position:absolute;left:8px;bottom:8px;z-index:3;font-size:11px;font-weight:700;color:#fff;background:rgba(0,0,0,.6);border-radius:2px;padding:2px 4px;pointer-events:none}
.dots{display:flex;gap:4px;margin:-8px 0 8px;position:relative;z-index:2}
.dots button{width:6px;height:6px;padding:0;border:0;border-radius:99px;background:var(--line);cursor:pointer}
.dots button.on{background:var(--fg)}
/* 손가락이 있는 화면에선 스와이프가 더 빠르다. 점은 자리만 먹는다. */
@media (hover:none){.dots{display:none;margin:0}}

/* 위계 3단계 — ①앨범명 ②아티스트 ③메타. 크기·굵기·색 세 지렛대만 쓴다.
   **한글에는 자간을 주지 않는다.** 벌리면 단어 사이 공백이 죽어 "판매처별특 전 비교"로 붙어 읽힌다.
   29CM도 --ruler-scale-letter-spacing: 0 이다. */
.card .ar{font-size:11px;color:var(--mut);font-weight:600;
white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card .al{font-size:16px;font-weight:700;line-height:1.28;margin:4px 0 8px;letter-spacing:-.01em;
display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* 태그 — 29CM 상품 카드 실측을 그대로 옮겼다.
     rounded-2 → 2px · px-4 py-2 → 2·4px · min-h-16 → 16px
     text-xxs-medium → 10px / weight 500 · bg-tertiary + text-secondary → 회색 배경에 회색 글자
   **테두리 알약이 아니다.** 배경으로 채우고 모서리는 거의 직각이다.
   경고(품절)만 액센트를 쓴다 — 나머지가 전부 무채라 그것만 튄다. */
.tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;position:relative;z-index:2}
.tg{display:inline-flex;align-items:center;min-height:16px;padding:2px 4px;border-radius:2px;
font-size:11px;line-height:1.2;font-weight:500;color:var(--mut);background:var(--card);white-space:nowrap}
.tg.w{color:var(--acc);font-weight:700}
.card .meta{font-size:12px;color:var(--dim);font-variant-numeric:tabular-nums;line-height:1.55}
/* 앨범 상세의 칩. --ok가 먹이 된 뒤로 테두리가 너무 세서 배경 칩으로 바꿨다.
   인덱스 카드는 이 클래스를 안 쓴다 — 거기선 굵기와 액센트로만 낸다(.card .meta). */
.badge{display:inline-flex;align-items:center;min-height:16px;font-size:11px;font-weight:500;color:var(--fg);background:var(--card);border:0;border-radius:2px;padding:2px 4px;margin-right:4px}
.sold{color:var(--acc);font-weight:700}
/* 판매처 순위 — 위의 비교표와 생김새가 겹치면 안 된다. 번호·이름·총액 세 덩어리뿐이다. */
.rks{list-style:none;margin:0;padding:0}
.rk{display:flex;align-items:baseline;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
.rk:first-child{border-top:2px solid var(--fg)}
.rkn{flex:0 0 20px;font-size:12px;font-weight:700;color:var(--dim);font-variant-numeric:tabular-nums}
.rkb{flex:1 1 auto;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:0 8px}
.rkb b{font-size:14px;font-weight:700}
.rkm{flex:0 0 100%;font-size:12px;color:var(--mut);margin-top:2px}
.rkv{flex:0 0 auto;font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.rk.part .rkv{font-weight:600;color:var(--mut)}
.rkv .est{margin-left:4px}
.soldb{display:inline-flex;align-items:center;min-height:16px;font-size:11px;font-weight:700;color:var(--acc);background:var(--card);border:0;border-radius:2px;padding:2px 4px}
.chart{display:inline-flex;align-items:center;min-height:16px;font-size:11px;font-weight:500;color:var(--mut);background:var(--card);border:0;border-radius:2px;padding:2px 4px}
.comp{margin-top:12px;border:0;border-top:1px solid var(--line);border-radius:0;padding:12px 0 0;background:none}
.comp summary{cursor:pointer;font-size:12px;font-weight:600;color:var(--mut)}
.comp pre{margin:8px 0 0;font-size:12px;line-height:1.65;white-space:pre-wrap;word-break:break-word;font-family:inherit;color:var(--fg)}
.comp p{margin:8px 0 0}
.cd{font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap}
.cd.urgent{color:var(--acc)}
.cd.over{color:var(--mut);font-weight:400}
.alarm{font-size:12px;white-space:nowrap}
.card .cdl{font-size:12px;color:var(--mut);margin-top:8px}
/* 검색 — 29CM 실측을 옮겼다. border-b-4 border-on-black · 36px semibold · placeholder #d4d4d4.
   **상자가 아니다.** 배경도 테두리도 없고 아래 굵은 선 하나뿐이다.
   저쪽은 전체화면 검색이라 36px이지만 우리는 목록 위 필터라 26px로 낮췄다 —
   그래도 이 화면에서 가장 큰 입력이고, 자기 아티스트를 찾는 게 이 페이지의 주 동작이라 그게 맞다. */
.find{margin:24px 0 0;display:flex;gap:16px;align-items:baseline;border-bottom:2px solid var(--fg)}
.find input{flex:1;min-width:0;padding:4px 0 8px;font:inherit;font-size:20px;font-weight:600;
letter-spacing:-.02em;color:var(--fg);background:none;border:0;border-radius:0}
.find input::placeholder{color:#d4d4d4;font-weight:600}
.find input:focus{outline:none}
.find .n{font-size:12px;color:var(--dim);white-space:nowrap;font-variant-numeric:tabular-nums}
.none-hit{font-size:14px;color:var(--mut);margin-top:24px}

/* 푸터 — 사이트 설명은 여기로 내렸다. 목록을 보러 온 사람에게 설명이 먼저 붙을 이유가 없다.
   접어두고, 궁금한 사람만 편다. */
.ft{margin-top:64px;border-top:1px solid var(--line);padding-top:16px}
.ft summary{cursor:pointer;font-size:12px;font-weight:600;color:var(--mut);list-style:none}
.ft summary::-webkit-details-marker{display:none}
.ft summary::before{content:'+ ';color:var(--dim)}
.ft[open] summary::before{content:'− '}
.ft .body{font-size:14px;color:var(--mut);line-height:1.8;margin-top:12px;max-width:62ch}
.ft .body b{color:var(--fg);font-weight:600}

/* 모바일 — 네이버 기준 이 카테고리 검색의 93%가 모바일이다 (코르티스 앨범: 모바일 4,730 / PC 360).
   가로 스크롤 표는 그 화면에서 안 읽히므로 행을 카드로 접는다. */
@media(max-width:700px){
  body{padding:16px 12px 56px}
  .alb{font-weight:700}
h1{font-size:20px}
  .wrap{overflow-x:visible}
  table{min-width:0;display:block}
  thead{display:none}
  tbody,tr,td{display:block;width:auto}
  tr{border:0;border-bottom:1px solid var(--line);border-radius:0;padding:12px 0;margin-bottom:0;background:none}
  td{border:0;padding:3px 0;display:flex;gap:8px;align-items:baseline}
  td.th{display:none}
  td::before{content:attr(data-label);flex:0 0 62px;color:var(--mut);font-size:12px;font-weight:600}
  td:not([data-label])::before{content:none}
  td.num{text-align:left;white-space:normal}
  td.rt{font-size:16px;font-weight:700}
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
/* 커버를 누르면 **앨범 페이지로 간다.** 버전 넘기기는 점과 스와이프가 맡는다 —
   목록에서 상품 사진을 누르면 상품으로 가는 게 몸에 밴 동작이라 그걸 거스르면 안 된다.
   끌어서 넘긴 경우는 클릭으로 치지 않는다(5px). */
var sx=0,moved=0;
strip.addEventListener('pointerdown',function(e){sx=e.clientX;moved=0});
strip.addEventListener('pointermove',function(e){if(e.buttons){var d=Math.abs(e.clientX-sx);if(d>moved)moved=d}});
strip.addEventListener('click',function(e){
if(moved>5){e.preventDefault();e.stopPropagation();return}
var lnk=w.parentElement.querySelector('.go');if(lnk){lnk.click()}
});
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
 * 측정 스크립트 3종.
 *
 * Vercel Web Analytics — 방문수·유입 경로. Pro에 포함이고 쿠키가 없다.
 * GA4 — 검색 쿼리별 유입과 랜딩 페이지. 서치콘솔과 붙는 쪽이 이것뿐이다.
 * Clarity — 세션 리플레이·히트맵. "특전 표를 실제로 끝까지 보는가"는 이것 말고 알 방법이 없다.
 *
 * 셋을 다 붙이면 본문(28KB)보다 스크립트가 무겁다.
 * 그래도 붙이는 이유는, 지금 단계에서 비싼 건 페이지 무게가 아니라 데이터가 없는 것이기 때문이다.
 * 셋 다 async/defer라 첫 렌더는 막지 않는다.
 *
 * SITE_URL 이 없는 로컬 빌드에는 넣지 않는다 — 로컬에서 연 페이지가 통계를 오염시킨다.
 */
const GA4_ID = 'G-N7EQZZPS6Q';
const CLARITY_ID = 'y8uije22n0';

const ANALYTICS = [
  '<script defer src="/_vercel/insights/script.js"></script>',
  `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_ID}"></script>`,
  `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA4_ID}');</script>`,
  `<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${CLARITY_ID}");</script>`,
].join('\n');

/**
 * 로고 마크.
 *
 * 로고 — 심볼 + 워드마크 락업.
 *
 * 실제 로고 16개를 재보고 정했다(가격비교·판매처·K서비스·국내 강브랜드).
 * 절반이 글자였고, 그 대부분이 **브랜드색 타일에 흰 글자를 파낸** 같은 형식이었다 —
 * 다나와 d, 에누리 e, 위버스 w, 29CM, KREAM, MUSINSA.
 * 선 아이콘을 쓴 건 경쟁자 kpopsite 하나뿐인데, 그게 무료 아이콘 티가 났다.
 *
 * 그래서 ㅌ(특전의 초성)을 타일에 판다.
 * 가로획 세 개의 길이를 다르게 둔 건 **표의 행**으로도 읽히게 하려는 것이다 — 우리가 파는 게 그 표다.
 * 획이 넷뿐이라 16px 파비콘에서도 안 무너진다. 먹지 배경(OG 카드)에서도 산다.
 */
const MARK =
  '<rect width="20" height="20" rx="4.6" fill="#c2410c"/>' +
  '<g fill="#fafafa">' +
  '<rect x="4.2" y="4.2" width="2.4" height="11.6"/>' +
  '<rect x="4.2" y="4.2" width="11.6" height="2.4"/>' +
  '<rect x="4.2" y="8.8" width="8.4" height="2.4"/>' +
  '<rect x="4.2" y="13.4" width="10.2" height="2.4"/>' +
  '</g>';

const LOGO = `<svg class="lg" width="26" height="26" viewBox="0 0 20 20" aria-hidden="true" focusable="false">${MARK}</svg>`;

/**
 * 사이트 이름 — **특전노트**.
 *
 * `K-POP 앨범 특전 비교`는 이름이 아니라 기능 설명이었다. 그래서 브랜드 자리와 제목 줄이
 * 같은 말을 두 번 하고 있었다.
 *
 * "노트"를 고른 이유 — 이 사이트가 파는 건 속도가 아니라 **정리와 신뢰**다.
 * 특전 상태를 넷으로 구분하고 미확인을 물음표로 남기는 태도가 그거고, 경쟁사의
 * "3단계로 간편하게"와 정확히 반대편이다. "특전"은 검색어이기도 하다.
 */
const BRAND = '특전노트';
const TAGLINE = 'K-POP 앨범 판매처별 특전';

/**
 * 상단 마스트헤드. **인덱스와 앨범 상세가 같은 걸 쓴다.**
 *
 * 검색 유입은 인덱스가 아니라 **상세로 직행한다**(롱테일). 그러니 대부분의 방문자가
 * 처음 보는 화면이 상세인데, 거기 사이트 표식이 없으면 어디에 온 건지 모른다.
 * 로고를 만들어놓고 정작 사람들이 가장 많이 보는 페이지에 안 붙이면 의미가 없다.
 *
 * 인덱스에서는 브랜드가 h1이고, 상세에서는 앨범명이 h1이라 브랜드를 링크로 낸다.
 */
const siteHeader = (stamp, { href } = {}) => {
  const mark = `${LOGO}<span class="bd">${BRAND}</span><span class="tl">${TAGLINE}</span>`;
  return `<header class="hd"><div class="hdrow">
${href ? `<a class="brand" href="${esc(href)}">${mark}</a>` : `<h1 class="brand">${mark}</h1>`}
<span class="hdm">${esc(shortDate(stamp).replace(/^\d+\./, '').replace('.', '월 '))}일 갱신</span>
</div></header>`;
};

/**
 * 파비콘 — 헤더 로고와 같은 마크.
 *
 * 헤더에만 두면 장식이고, 탭·북마크·홈화면까지 따라와야 사이트의 표식이 된다.
 * SVG를 data URI로 인라인한다. 파일이 안 늘고 요청도 안 는다.
 * 헤더 로고와 **완전히 같은 도형**을 쓴다. MARK 하나만 고치면 둘 다 따라온다.
 */
/**
 * 워드마크용 서브셋 폰트.
 *
 * 로고 글자가 기기 폰트에 따라 모양이 바뀌면 그건 로고가 아니다.
 * text= 로 **'특전'·'노트' 네 글자만** 잘라 받는다 — 한글 폰트가 보통 수 MB인데 이건 3KB 안쪽이다.
 * display=swap 이라 폰트가 늦어도 글자는 먼저 뜬다.
 *
 * 이 사이트에서 유일한 외부 요청이다. 그 값을 치르는 이유는 로고 모양이 흔들리면 안 되기 때문이다.
 */
const WEBFONT =
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@800&text=%ED%8A%B9%EC%A0%84%EB%85%B8%ED%8A%B8&display=swap">';

const FAVICON = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">${MARK}</svg>`
)}">`;

/**
 * 특전 실물 제보.
 *
 * 판매처 대부분이 특전을 발매 전까지 공개하지 않는다(문구 83건 중 44건이 "미공개").
 * 그래서 실물을 볼 방법은 받아본 팬이 올려주는 것밖에 없다.
 *
 * 받는 건 사진 1장과 어느 버전인지뿐이다. **이름도 연락처도 안 받는다** —
 * 사진 붙일 자리만 알면 되는데 개인정보를 받으면 지켜야 할 것만 늘어난다.
 *
 * 올린 즉시 안 나온다는 걸 화면에 적는다. 바로 안 보이면 실패한 줄 알고 다시 올리게 되고,
 * 그러면 검수 대기열이 같은 사진으로 막힌다.
 *
 * 브라우저에서 미리 줄여 보낸다 — 요즘 폰 사진은 한 장에 5MB가 넘어서
 * 그대로 올리면 상당수가 용량 제한에 걸린다.
 */
const reportJs = (slug) => `<script>
(function(){
var S=${JSON.stringify(slug)};
document.querySelectorAll('[data-report]').forEach(function(btn){
btn.addEventListener('click',function(e){
e.preventDefault();
var key=btn.getAttribute('data-report')||'';
var msg=btn.parentElement.querySelector('.rmsg');
function say(t){if(msg)msg.textContent=' '+t}
var inp=document.createElement('input');
inp.type='file';inp.accept='image/jpeg,image/png,image/webp';
inp.addEventListener('change',function(){
var f=inp.files&&inp.files[0];if(!f)return;
say('줄이는 중…');
var img=new Image(),fr=new FileReader();
fr.onload=function(){img.src=fr.result};
img.onload=function(){
var max=1400,sc=Math.min(1,max/Math.max(img.width,img.height));
var c=document.createElement('canvas');
c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
c.getContext('2d').drawImage(img,0,0,c.width,c.height);
say('보내는 중…');
fetch('/api/report',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({slug:S,versionKey:key,image:c.toDataURL('image/jpeg',0.82)})})
.then(function(r){return r.json()})
.then(function(d){say(d.ok?'보냈습니다. 확인 후 올라갑니다':(d.error||'실패했습니다'))})
.catch(function(){say('실패했습니다')});
};
img.onerror=function(){say('이미지를 읽지 못했습니다')};
fr.readAsDataURL(f);
});
inp.click();
});
});
})();
</script>`;

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
${FAVICON}
${WEBFONT}
${metaTags({ title, ...rest })}${ld}${analytics}
<style>${CSS}${RLOGO_CSS}</style></head><body>${body}</body></html>`;
};

const won = (n) => (n == null ? '?' : `${n.toLocaleString()}원`);

/** "2026. 8. 27. AM 10:06:57" → "2026.8.27" — 메타 설명에 초 단위는 노이즈다 */
const shortDate = (stamp) =>
  String(stamp ?? '')
    .split(/오전|오후|AM|PM|\d{1,2}:\d{2}/)[0]
    .replace(/\s*\.\s*/g, '.')
    .replace(/[.\s]+$/, '')
    .trim();

/**
 * 판매처 로고. 파비콘을 받아 40px PNG로 줄여 넣었다(6곳 합쳐 4KB).
 *
 * 핫링크는 못 쓴다 — 실측하면 /favicon.ico가 7곳 중 3곳만 살아 있고 알라딘은 238KB짜리
 * .ico를 준다. 판매처 행마다 외부 요청이 붙는 것도 곤란하다. 위드뮤는 쓸 만한 아이콘이
 * 아예 없어서 이름 첫 글자로 대신한다 — 자리는 남겨야 줄이 안 어긋난다.
 */
const RLOGO = {
  Ktown4u: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoBAMAAAB+0KVeAAAAMFBMVEUAr8oBkMgTUMwFaMwCfMwEgsIAkcgFhcgAnMgDhscMX8oJYMoAwcsAn8gAvssAzM3JrOWpAAAADXRSTlP++/3+/AXQVZQnvInS7OTUAgAAAAlwSFlzAAAD6AAAA+gBtXtSawAAAbpJREFUeNptkzFLw0AUx98HMKUHIVuW1MlNz8mt9OjgfkhHQUIQndvg3gTsGoprFyH9AIVOfgBRs3TyxE9w/QaN771LagVv/OX3fy959wJ6NImFf7sqtNZX+QscJamGQzifvYDHcJ5fC3+4TDU+ZpgV8ISiUOoS1fnsDQA2SQrjqRC+UnKZjiav9hs8s8kgn5Io5clqPHuzFsBsEoivkQ3kWVTmrzWaxlSxgxLhyd17jaJnKgFUkcSo36l3lGZIXWQU9brb2lK8Iqj2Ys3NjRCgnHjcrRFynCGLpyjuGjOAA9HBEF/pV2zSJshh0LZuYRVkINvW+5I4kH/EApD9EQMaMqZZ3NkGZoWm7qdf9IXI6M2Hz1qD8VVoUbM8IeNfPKMJVQjbXcvEIMLbAkxZ59EofZzrqnDEdqAVI1ThkJEYoQoNYsZiTy6hOR6FWezJEuCbmKHDYiSlcp7hcCOeM/wgLQxbEaHnUTm6mUaUSsGnK4dnLyqI7w3VEyIuW1EwJE8k60Ujxrh1DsbZeI2MxIT3k8V09LBgES+ON5lE3OS1E1O38yJ4pJ1/KHGJ8LH7O1jEv2N9o/pJqn8AeyZDArEVLjMAAAAASUVORK5CYII=',
  '알라딘': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoBAMAAAB+0KVeAAAAMFBMVEXsZqzShp3d3ef3mUfuOJf8rxj+/f5YdKbqK49Aa7Hvocf21uSEV6XERJzwXG6vfbjeOYJGAAAABHRSTlP8agH3AKHXjQAAAAlwSFlzAAAD6AAAA+gBtXtSawAAAU5JREFUeNpt0bFqwzAQBuALGBPIErJkjt+gQ3ZDj2IIBErp3klDvAZMNg8aRF/ACBIw1C3BhtKlGdI1Qx8gb1D6HpV0suyoucHDh+7XjwzROEAzt492biKYWUP8bXUC49Zw2eI9uINdwEMfcW4VeuYCLhB/rqEN8HB5DamsjybAx2T0coGJ/uTp4bOP+QdHXOzz9AKfuNrOq3AOZ0wEbfNKYRind69wEhigUBM3aSBwsTqG77AbMZbWJdQHxliZiDo4DKGo64a5+SqhWXGQ33qzY5YOEeQOUfCRs2PAEYqtvlq0WgpVForNWSt/M1aZegrXVN3cTpWhyLbUPWdsRaZRmn18Vsgdbk7mZKjW9w6zHT2kqeiQQgVA0K1nVEq9ijXCtfdPNNp9D+U1pFIeUqkeavNCc0Jbyk4M0+xf6ABmBvuh8QSi6UZK2QuNB9EfylcORkCkhDIAAAAASUVORK5CYII=',
  '사운드웨이브': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoBAMAAAB+0KVeAAAAMFBMVEX91dr609gWRkP/2uAMQT2VlZYlT03WvcHry8+4q62kn6HGs7Z9h4dre3s7XVxVbW3dBnHAAAAACXBIWXMAAAPoAAAD6AG1e1JrAAABSElEQVR42mNgGPpAUICRkUGAQUCAUQAuxihswGxgDGQYMCMUCosvbQ+PKu/cujMSrpLR/Jpb6Z8zv/qvnj+zGSbKvM5Jbef90KvrDsetmQwVZLRKUVKbuTy0M3LjVrh2gTonJbcN3OXtO3d372yGigofUVK71WA7tebP37l/iyGCjBxPlFSZGW3Oxv658/IPTNAyReWjIQN7aOT07RGrYIJWSinBjYIMjY3CDIwSMIsYOzouJT23SEu6aOqWNhkuav5E5YWpk8pheSc3hONlnFQuA921OUjJrwEmWHVJSenqIyW1mCQlH0NYcCxzUvL7oqSkn6Kk8pwRJhikpPLyi5LKzRQlt8Uw3cKLlPw2flHR7U5SyUKEZpDbcYsvegstU3LhdjMIbF1uzLh0hgF71EZDpCgyFgTGhCADs4EASrwxMALFQXjIAwB9gWUtVuaT6gAAAABJRU5ErkJggg==',
  '뮤직플랜트': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoBAMAAAB+0KVeAAAAMFBMVEUAAAARGw0AAAAAAAAAAQBkq0X+/v5ptEg3RjBKfjNamz7p6emysrHMzMxnZ2ecnJwrT1cLAAAABHRSTlMD9F62FdF0GwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAT1JREFUeNpt079Kw0AcB/CzT6CYouDSwRcQfIG0N6SCSsFw0s3li4OOIZpNCPWGLkJBHQWl1Fl8AnHqnEfIExQnB3N/frnY3He6fLjL7y73C2Osc8Ab2e6xKp2A/0uodJ+vpV9N5K302EYbN9ur1fpDGkbP74s7PRowqj2cp2maPOj6jObNY5V0ph4I72OTLHAYJRbFi0OaGMe3Dt9qFDlhvbrKK+GRs/iGcMespJcyV0csNI4JH82UrtagiWemniAMt6oEa2ijN1Hj7zKfLleRPsLY4gmQF/gYJs0t7QEShLT5H2Ba48hgBOCbUMwMHkPHYGY/XdnEkcHwEwVgqyf2Ok5xVeJ6olHfhsIJLkpcakzPucUCqxJfCrMnc9yqGaTku5JHMghtY4SubVwG/gbztqK3ab3t7f8RPL/MH0ct9qM4BKMvAAAAAElFTkSuQmCC',
  '애플뮤직': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoBAMAAAB+0KVeAAAAMFBMVEXtGyNMaXHkBBjtGyPzHCTuGiPsGiLvGyPsGiLxGyPtGiLqGiHlGSLtHCT9HSb3HSU3Q5U5AAAADXRSTlP8AAOi/IgpzlHpakERsG5xLgAAAAlwSFlzAAALEwAACxMBAJqcGAAAAYlJREFUeNp9kz1LA0EQhqcIWG2OXTAGtdmA9iJpJEgKCyN4IgGxEuNHYWcvGgRtLPQHGBQFwSoQsLFMkX4LG4slgqaIxSWFEFEUd3fmYi4R3+Ju7rmb3bl3ZoFbpXjiJJ++3TCBFdiL4Nu730HQGlpBaqGQm/EvMKq/7HFJUE74CrQRQCsjEIrEATCNgmZFOijv2yHT2lsQFoqxuV+m1dKVNFDuZHWP2LywXxZZL1S5ggQx/KQjik9xkFsqCtW7ADmL2QqoLtWRkGAYsyDIYuQdAi0JzXT+QtGiMNJ2UT3DeQ0LjpVg3b1WHzyVkkcYf8IZwxTjmRh1S6kGlC1UjwVrGf6HeoY1vFvHuKQHcGWqBsLyX/D0v3TMyFUdDDeikpbN7iLZJojFG2tN8Wi3gfib6uGa8+QlI0iGxDqrx0Xsi4GhdV4QUFMNHDDZwTvdJwMHGmchH4+2GGHfMCCMjg1BO2CD0I5iBL66oa350IO9Eo23vwhdvVXCg7AfdHUugI7M5M00aaYqfwCMlrmQEEXoZgAAAABJRU5ErkJggg==',
  '위버스샵': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoBAMAAAB+0KVeAAAAMFBMVEUAy9X///8AyNIEzNb9///5/v5p4ObQ9fgo09xC2eCt7/Lo+/sXz9iQ6e1W3eOA5epcpnLSAAAACXBIWXMAABYlAAAWJQFJUiTwAAABAUlEQVR42mNgGBzAgBlTjEnZSAFDUHN51SQMhR9dXOTRlDLrCa57JfjIAFlMSYldVknpYoGSEpK6jo6pnh0dUyI7OgwQekUEXVwEQdgRbgKzmqigoyAQiAgGJiEJuriIuLg4irigCIo4OoqGiISgqhR0dcTULtWT6DZdfroIiqCswuk96hK6oqjaF7UUnPbQDEQRdFw0cdHRzUwfUQQDLyUmNS46uRBVZVKWUXtTIqr2wE9Mh5U0Njqiqtx5bv+JbDR3CooEOoaKOCILagJDScRFEBhQjpMQYVcY4gIGruKIsGeaLSIIBo47kaJJ43o5GNQ2IUcSVAETavKAGs4wWAEAf3lOYK3zwV0AAAAASUVORK5CYII=',
};
/** data URI를 판매처 행마다 심으면 43번 복제된다(실측 +34KB). 규칙 6줄로 한 번만 싣는다. */
const RKEYS = Object.keys(RLOGO);
const RLOGO_CSS = RKEYS.map((k, i) => `.rl${i}{background-image:url(${RLOGO[k]})}`).join('');
const retailerMark = (name) => {
  const i = RKEYS.indexOf(name);
  return i >= 0
    ? `<span class="rlg rl${i}" aria-hidden="true"></span>`
    : `<span class="rlg mono" aria-hidden="true">${esc(name.slice(0, 1))}</span>`;
};

/** 특전 상태 — "없음"과 "종료"와 "비공개"와 "확인 못함"은 전부 다른 정보다 */
/**
 * 특전 상태와 **각주**.
 *
 * 실측하면 전체 561건 중 내용까지 아는 건 12%뿐이다 — `확인 못함` 34%, `특전 없음` 34%,
 * `구성 비공개` 13%. **88%가 불확실하다.**
 *
 * 상점이라면 이걸 감춰야 한다. 재고와 가격이 확정이라 전제하고 파는 곳이니까.
 * 우리는 자료다. 그래서 **모른다는 걸 등급으로 드러내고, 왜 모르는지를 각주로 적는다.**
 * 나무위키가 하는 방식이고, 이게 이 사이트를 상점과 갈라놓는 지점이다.
 */
const FOOTNOTES = [
  ['none', '위버스샵이 상품 아이콘에 BENEFIT을 달지 않은 경우입니다. 여기서는 특전이 없다고 단정할 수 있습니다.'],
  ['secret', 'Ktown4u가 "특전 (구성은 비공개입니다)"라고 명시한 경우입니다. 특전은 있지만 무엇인지는 구매 전까지 알 수 없습니다.'],
  ['listed', '판매처가 상품명에만 특전을 표기하고(뮤직플랜트 [특전증정/…], 애플뮤직 [애플특전]) 상세에는 내용을 싣지 않은 경우입니다.'],
  ['ended', '알라딘 상세의 증정 종료 문구를 읽은 것입니다. 특전 자체가 없었다는 뜻은 아닙니다.'],
  ['unknown', '판매처가 상세에 특전 문구를 싣지 않았거나 요청이 실패한 경우입니다. **특전이 없다는 뜻이 아닙니다.**'],
];
const FN_NO = Object.fromEntries(FOOTNOTES.map(([k], i) => [k, i + 1]));
const fn = (k) => (FN_NO[k] ? `<sup class="fnr"><a href="#fn-${FN_NO[k]}" id="fnr-${FN_NO[k]}">[${FN_NO[k]}]</a></sup>` : '');

const STATUS = {
  has: null, // 내용을 표시
  none: `<span class="none">특전 없음</span>`,
  ended: `<span class="mut">증정 종료</span>`,
  secret: `<span class="flag">특전 있음 · 구성 비공개</span>`,
  // 판매처가 상품명에 특전을 달아뒀지만(뮤직플랜트 [특전증정/…], 애플뮤직 [애플특전])
  // 내용은 못 읽은 경우. "특전 없음"과 절대 섞으면 안 된다 — 정반대 정보다.
  listed: `<span class="flag">특전 있음 · 상품명에만 표기</span>`,
  unknown: `<span class="mut">특전 미표기</span>`,
};

/** 본문에서 실제로 쓰인 각주만 하단에 낸다. 안 쓴 각주를 다 늘어놓으면 그건 안내문이지 각주가 아니다. */
const footnoteList = (html) => {
  const used = FOOTNOTES.filter(([k]) => html.includes(`#fn-${FN_NO[k]}"`));
  if (!used.length) return '';
  return `<section class="fns"><h2>각주</h2><ol>${used
    .map(
      ([k, text]) =>
        `<li id="fn-${FN_NO[k]}"><a class="bk" href="#fnr-${FN_NO[k]}">↑</a> ${text.replace(
          /\*\*(.+?)\*\*/g,
          '<b>$1</b>'
        )}</li>`
    )
    .join('')}</ol></section>`;
};

/**
 * 뷰 토글 — 비교(카드) / 표.
 *
 * 훑을 때와 자세히 볼 때 필요한 게 다르다. Pangram Pangram도 카드 뷰와 리스트 뷰를 나눠 둔다.
 * 기본은 카드다 — 이 페이지의 목적이 판매처 비교라서.
 * **표를 지우지 않는다.** 8열의 밀도가 필요한 사람이 있고, 그건 취향이 아니라 다른 작업이다.
 */
const VIEW_JS = `<script>
(function(){
/* 버전 탭 — 첫 패널만 남기고 접는다. 패널은 DOM에 그대로 있어서 크롤러는 전부 읽는다. */
var tabs=document.querySelector('.vtabs');
if(tabs){
var ps=[].slice.call(document.querySelectorAll('.vp'));
function show(n){
/* .vp+.vp 여백은 JS가 없을 때 패널을 세로로 쌓는 용도다.
   탭으로 하나만 보일 때는 그게 그대로 남아 2번째 탭부터 위가 붕 뜬다. */
ps.forEach(function(p,i){p.style.display=i===n?'':'none';p.style.marginTop='0'});
tabs.querySelectorAll('.vt').forEach(function(b,i){b.className=i===n?'vt on':'vt'});
}
tabs.querySelectorAll('.vt').forEach(function(b,i){
b.addEventListener('click',function(){show(i)});
});
show(0);
}
/* 사진 넘기기. 화살표는 여기서 만든다 — JS가 없으면 가로로 밀어서 보면 되고,
   빈 버튼이 마크업에 남지 않는다. */
document.querySelectorAll('.pgal[data-gal]').forEach(function(w){
var m=w.querySelector('.pgm');if(!m)return;
function tb(){return [].slice.call(w.querySelectorAll('.pgt button'))}
function at(){return Math.round(m.scrollLeft/(m.clientWidth||1))}
function go(n){var t=tb();m.scrollTo({left:m.clientWidth*Math.max(0,Math.min(t.length-1,n)),behavior:'smooth'})}
function mark(){
var n=at(),t=tb();
t.forEach(function(b,i){b.setAttribute('aria-current',i===n?'true':'false')});
w.querySelector('.gnav.p').style.visibility=n?'':'hidden';
w.querySelector('.gnav.n').style.visibility=n>=t.length-1?'hidden':'';
}
function mk(cls,txt,dir){
var b=document.createElement('button');b.type='button';b.className='gnav '+cls;b.textContent=txt;
b.setAttribute('aria-label',dir<0?'이전 사진':'다음 사진');
b.addEventListener('click',function(){go(at()+dir)});
w.appendChild(b);
}
mk('p','\\u2039',-1);mk('n','\\u203a',1);
/* 화살표는 사진 세로 가운데에 — 캡션·썸네일 높이를 빼야 사진 밖으로 안 나간다. */
var first=m.querySelector('img');
function place(){
if(!first)return;
w.querySelectorAll('.gnav').forEach(function(b){b.style.top=(first.getBoundingClientRect().height/2-17)+'px'});
}
/* 배너를 빼면 썸네일 순서가 바뀐다 — 클릭 시점에 위치를 다시 센다. */
var pgt=w.querySelector('.pgt');
if(pgt)pgt.addEventListener('click',function(ev){
var b=ev.target.closest('button');if(b)go(tb().indexOf(b));
});
var tick;m.addEventListener('scroll',function(){clearTimeout(tick);tick=setTimeout(mark,90)});
addEventListener('resize',place);
if(first&&!first.complete)first.addEventListener('load',place);else place();
mark();
});
/* 탭·포장을 옮길 때마다 표 높이가 달라져 아래 섹션이 튄다.
   모든 (탭 × 포장) 조합을 재서 가장 높은 것에 바닥을 맞춘다.
   이미지가 없는 표라 높이가 로딩에 흔들리지 않는다. */
function levelPanels(){
var ps=[].slice.call(document.querySelectorAll('.vp'));
if(ps.length<2)return;
var prev=ps.map(function(p){return p.style.display}),max=0;
ps.forEach(function(p){
p.style.minHeight='';p.style.display='';
var pps=[].slice.call(p.querySelectorAll('.pp'));
if(!pps.length){if(p.offsetHeight>max)max=p.offsetHeight;return}
var pp=pps.map(function(x){return x.style.display});
pps.forEach(function(x,j){
pps.forEach(function(y,k){y.style.display=k===j?'':'none'});
if(p.offsetHeight>max)max=p.offsetHeight;
});
pps.forEach(function(x,j){x.style.display=pp[j]});
});
ps.forEach(function(p,i){p.style.display=prev[i];p.style.minHeight=max+'px'});
}
var lvl;addEventListener('resize',function(){clearTimeout(lvl);lvl=setTimeout(levelPanels,150)});

/* 포장(낱개·세트) — 탭 안의 하위 선택. 탭을 둘로 쪼개는 대신 여기서 고른다. */
document.querySelectorAll('.psw').forEach(function(sw){
var vp=sw.parentElement,pps=[].slice.call(vp.querySelectorAll('.pp'));
function pick(n){
pps.forEach(function(p,i){p.style.display=i===n?'':'none'});
sw.querySelectorAll('.pb').forEach(function(x,i){x.className=i===n?'pb on':'pb'});
}
sw.querySelectorAll('.pb').forEach(function(b,i){b.addEventListener('click',function(){pick(i)})});
pick(0);
});
levelPanels();
})();
</script>`;

/**
 * 나무위키식 번호·앵커·목차.
 *
 * 섹션 빌더들이 이미 `<h2>`를 내므로 건드리지 않고 **후처리**로 번호와 앵커를 단다.
 * 이 페이지는 표가 10개 넘게 쌓여서 **목차가 유일한 항해 수단**이다.
 */
function wikiIndex(html) {
  const items = [];
  const body = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, inner) => {
    const n = items.length + 1;
    items.push({ n, label: inner.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() });
    return `<h2 id="s-${n}"><span class="sn">${n}.</span> ${inner}</h2>`;
  });
  const toc =
    items.length >= 3
      ? `<nav class="toc"><b>목차</b><ol>${items
          .map((i) => `<li><a href="#s-${i.n}"><span class="sn">${i.n}.</span> ${esc(i.label)}</a></li>`)
          .join('')}</ol></nav>`
      : '';
  return { body, toc };
}
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
      name: `${rt} ${artistName} ${target.album}`,
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
      `<b>${retailerNames.join(' · ')}</b> ${retailerNames.length}곳에서 팝니다. 상품값은 대체로 같고 판매처마다 주는 특전이 다릅니다.`,
    ],
    [
      `${album} 버전은 몇 종인가요?`,
      `<b>${versions}종</b>입니다. 버전마다 구성품과 포토카드가 다릅니다. 판매처 특전은 그 위에 따로 붙습니다.`,
    ],
    best
      ? [
          `전 버전을 다 모으려면 얼마인가요?`,
          `배송비와 쿠폰까지 넣어 <b>${won(best.sum)}</b>입니다.`,
        ]
      : null,
    [
      `특전은 언제까지 주나요?`,
      `<b>예약판매 기간 내 선착순</b>이 대부분이고 수량이 소진되면 끝납니다. 이 페이지는 하루 두 번 갱신됩니다.`,
    ],
  ].filter(Boolean);
  return `<h2>자주 묻는 질문</h2>
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
function countdownHtml(deadlines, slug, siteUrl, subject, cover) {
  if (!deadlines?.length) return '';
  const now = Date.now();
  const cards = deadlines
    .map((d) => {
      // 캘린더에 들어간 뒤에는 앨범명이 없으면 무슨 일정인지 알 수 없다.
      const g = googleUrl({
        at: d.at,
        title: [subject, d.label].filter(Boolean).join(' · '),
        desc: d.note,
        url: d.url,
      });
      return `<div class="dl">
<div class="dlt">${esc(d.label)}${d.kind === 'fansign' ? ' <span class="flag">팬싸</span>' : ''}</div>
<div class="dlc"><span class="cd" data-until="${esc(d.at)}">${esc(roughLeft(d.ms - now))}</span></div>
<div class="dlm">${esc(kst(d.at))} · <a href="${esc(g)}" rel="nofollow noopener" target="_blank">캘린더</a></div>
</div>`;
    })
    .join('');

  return `<h2>남은 시간 <span class="one">실시간</span></h2>
<div class="hero">${
    cover ? `<img class="hcv" src="${esc(cover)}" alt="${esc(subject)}" width="400" height="400" fetchpriority="high" decoding="async">` : ''
  }<div class="dls">${cards}</div></div>
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
  const limits = '';

  if (!events?.length) {
    return `<h2>팬사인회 · 이벤트 <span class="one">메이크스타</span></h2>
${limits}`;
  }

  // 이벤트도 같은 항목을 여러 건에 대해 견주는 자료다 — 카드 넉 줄씩 쌓지 않고 표로 접는다.
  const rows = events
    .map((e) => {
      const when = e.closing
        ? '<span class="sold">마감임박</span>'
        : e.dday != null
          ? `<b>D-${e.dday}</b>`
          : '<span class="mut">진행중</span>';
      // 어떤 버전을 얼마에 사야 응모되는지 — 이게 없으면 아래 특전표와 이어지지 않는다
      const opts = (e.options || [])
        .map((o) => `${esc(o.name)}${o.krw != null ? ` <b>${won(o.krw)}</b>` : ''}`)
        .join(' · ');
      const title = e.url ? `<a href="${esc(e.url)}" rel="nofollow">${esc(e.title)}</a>` : esc(e.title);
      return `<tr>
<td class="evt" data-label="이벤트">${title}${e.fansign ? ' <span class="tg">팬싸</span>' : ''}
<div class="mut">${esc(e.label)}</div></td>
<td class="num" data-label="마감">${when}</td>
<td class="num" data-label="기간">${esc(e.from)}~${esc(e.to)}${e.winnerAt ? `<div class="mut">발표 ${esc(e.winnerAt)}</div>` : ''}</td>
<td data-label="응모 조건">${opts || '<span class="mut">—</span>'}</td></tr>`;
    })
    .join('');

  return `<h2>팬사인회 · 이벤트 <span class="one">메이크스타</span></h2>
<p class="mut">메이크스타 구매분만 응모됩니다. 응모 마감 뒤 취소·환불 불가.</p>
<div class="wrap"><table class="cmp"><thead><tr>
<th>이벤트</th><th class="num">마감</th><th class="num">기간</th><th>응모 조건</th></tr></thead><tbody>${rows}</tbody></table></div>
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
  reports,
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

  const allShots = [];
  const panels = groups
    .map(([key, items]) => {
      const [edKey, pk] = key.split('｜');
      /**
       * 제목은 **키가 아니라 `edition`에서 가져온다.**
       *
       * 키는 매칭용 슬러그라 사람이 읽을 값이 아니다 — `photobook`, `ohitx27shot`처럼 나온다.
       * `edition`에는 판매처가 쓴 원문("PHOTO BOOK Ver.", "Unnatural+Gazed+Break ver.")이 들어 있다.
       * 판매처마다 표기가 조금씩 달라서 **가장 많이 쓰인 표기**를 고른다.
       * (엔티티 미디코딩 문제는 수집 쪽 버그다 — docs/38-프론트-작업상태.md §4ⓑ)
       */
      const edCount = new Map();
      for (const x of items) {
        const e = String(x.edition || '').trim();
        if (e) edCount.set(e, (edCount.get(e) || 0) + 1);
      }
      const ed = [...edCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || edKey;
      const retailers = new Set(items.map((x) => x.retailer));
      const badge =
        retailers.size >= 2 ? `<span class="ok">${retailers.size}개 판매처 비교</span>` : `<span class="one">1곳만</span>`;
      /**
       * 사진 — **있는 것만 보여준다.**
       *
       * 전에는 판매처마다 칸을 만들고 이미지가 없으면 점선 상자를 그렸다.
       * 판매처가 7곳이면 이미지 1장에 **빈 상자 6개**였다. 게다가 그 칸에 넣던 특전 문구는
       * 바로 아래 표에 이미 있어서, 빈 상자들이 같은 정보를 못생기게 반복하고 있었다.
       *
       * 갤러리가 유일하게 기여하는 건 이미지다. 그래서 이미지가 있는 것만 남긴다.
       *
       *   특전 이미지   위버스샵만 준다. 나머지 6곳은 실측 0장 — 그 사이트에 데이터가 없다
       *   구성품 이미지  Ktown4u 상세. **소속사가 만든 공통 시트라 특전이 아니다.**
       *                 치수와 랜덤 확률(`PHOTOCARD A 55×85mm / Random 1 out of 12`)까지
       *                 적혀 있어 "이 버전 사면 뭐가 오나"에 답한다. 버전의 59%에 붙는다.
       */
      const urlOf = (x) => (typeof x === 'string' ? x : x && x.url) || null;
      /**
       * **세로로 긴 이미지를 지우면 안 된다.** 한 번 그렇게 했다가 되돌렸다.
       *
       * 위버스샵 benefitImage(1000×6140)를 열어보니 공지문이 아니라
       * "증정 상품 — 미공개 셀카 포토카드 5종 중 랜덤 1종" + 실제 포토카드 사진이었다.
       * 판매처 상세페이지는 원래 세로로 길다. 비율 2.4로 거르면 특전 이미지
       * 37건 중 30건(81%)이 사라진다 — 판매처가 특전을 공개 안 하는 게 이 사이트의
       * 존재 이유인데 유일하게 확보한 자료를 지우는 셈이다.
       *
       * 문제는 표시 방법이었다. 1:6 이미지를 540px 칸에 통째로 넣으면 폭이 88px이라
       * 아무것도 안 읽힌다. 그래서 긴 것만 **칸 안에서 위아래로 넘겨 보게** 한다.
       */
      const dim = (i, u) => (i.images || []).find((x) => x && x.url === u) || null;
      const isTall = (d) => !!(d && d.w && d.h && d.h / d.w > 2.4);
      const shots = [];
      for (const i of items) {
        if (i.benefitImage)
          shots.push({ url: i.benefitImage, cap: `${i.retailer} 특전`, note: '', tall: isTall(dim(i, i.benefitImage)) });
      }
      // 구성품은 버전당 한 장이면 된다 — 판매처가 달라도 같은 소속사 시트다
      const usable = (i) => (i.images || []).filter((x) => urlOf(x) && urlOf(x) !== i.benefitImage);
      const compSrc = items.find((i) => i.retailer === 'Ktown4u' && usable(i).length) || items.find((i) => usable(i).length);
      const compPick = compSrc ? usable(compSrc)[0] : null;
      const compShot = compPick ? urlOf(compPick) : null;
      const compFrom = compSrc ? compSrc.retailer : '';
      /**
       * **"판매처 공통"이라고 쓰면 안 된다.** 검증한 적이 없는 주장이다.
       * 실측: photobook｜개별에서 Ktown4u는 yIgtb8.jpg, 위버스샵은 전혀 다른 파일을 갖고 있고
       * 나머지 5곳은 이미지가 아예 없다. 우리는 그중 한 장을 골라 보여줄 뿐이다.
       * 그래서 **어디서 가져온 것인지**를 적는다. 그게 확인된 사실의 전부다.
       */
      if (compShot)
        shots.push({
          url: compShot,
          cap: `구성품 (${compFrom})`,
          note: '판매처 특전이 아닌 앨범 기본 구성품',
          wide: true,
          tall: isTall(compPick),
        });

      // 팬이 보내준 실물 사진. 판매처가 공개하지 않는 특전은 이것 말고는 볼 방법이 없다.
      // 사람이 승인한 것만 여기까지 온다 (api/review.js).
      for (const rp of reports || []) {
        // 제보에 버전이 적혀 있으면 그 버전에만 붙인다. 안 적혀 있으면 전 버전에 보여준다 —
        // 어느 버전인지 몰라도 "이 앨범 특전이 이렇게 생겼다"는 정보는 남는다.
        if (rp.versionKey && rp.versionKey !== key) continue;
        shots.push({
          url: rp.url,
          cap: rp.retailer ? `${rp.retailer} 실물` : '실물 제보',
          note: '팬 제보',
        });
      }

      /**
       * 사진은 **버전마다 따로 두지 않고 페이지 맨 위 갤러리 하나로 모은다.**
       *
       * 버전별로 두면 다른 버전 특전을 보려고 탭을 눌러야 하는데, 팬이 여기 오는 이유가
       * 정확히 "버전별로 뭐가 다른가"라서 그게 제일 보고 싶은 걸 제일 어렵게 만든다.
       * 캡션에 버전명을 붙여 어느 것인지는 사진 밑에서 읽게 한다.
       */
      for (const sh of shots) allShots.push({ ...sh, ver: ed === '기본' ? '기본반' : ed });
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

      /**
       * 판매처 카드 — Pangram Pangram 구조를 번역한 것.
       *
       * 폰트 파운드리는 폰트를 **설명하지 않고 표본으로 보여준다**(Aa, 알파벳, 팬그램 문장).
       * 사는 사람이 판단할 근거를 화면에 크게 놓는 게 그 사이트가 목록만으로 최고상을 받은 이유다.
       *
       * 우리는 그 표본이 없다 — 특전 이미지 보유율이 **7%(37/561)** 다.
       * 폰트는 브라우저가 공짜로 렌더하지만 특전 사진은 판매처가 안 준다.
       * 그래서 표본 자리를 **특전 텍스트 자체**로 채운다. 표 한 칸에 문장을 욱여넣으면
       * 판매처끼리 비교가 안 되는데, 그게 이 페이지가 존재하는 이유다.
       *
       * 정보 순서를 고정한다(PP도 그렇다): 판매처 → 가격 → 재고·한도 → **특전** → 링크.
       * 표는 없애지 않고 뷰 토글로 남긴다 — 밀도가 필요한 사람이 있다.
       */
      /**
       * 판매처 비교는 **표가 맞다.**
       *
       * 카드로 늘어놓으니 판매처 여덟 곳이 세로로 길게 흘러서, 정작 견줘야 할
       * 가격·특전이 서로 멀어졌다. 같은 항목을 여러 대상에 대해 비교하는 건 표의 일이다.
       * 열은 셋만 둔다 — 재고·한도·이벤트는 판매처명 밑 태그로 접는다.
       */
      /**
       * **21줄이 같아 보였던 건 중복이 아니라 내가 구분을 지웠기 때문이다.**
       *
       * 표를 3열로 압축하면서 상품명 열을 뺐는데, NCT 127 JET Poster를 실측하면
       * 애플뮤직 6줄은 `[쟈니][8/30 영상통화]`…`[해찬]`으로 **전부 다른 상품**이고
       * 알라딘 7줄은 국내반 1 + `[수입]` 6이다. 이름을 지우니 복붙처럼 보인 것이다.
       *
       * 그래서 두 가지를 한다.
       *   ㄱ. 상품명 앞 대괄호를 **변형 이름**으로 뽑아 판매처 밑에 태그로 단다.
       *   ㄴ. 판매처·가격·특전·품절이 모두 같은 줄을 **한 줄로 합치고**, 변형만
       *       태그로 늘어놓는다. 태그마다 제 상품 링크를 건다.
       * 실측: jetposter｜개별 21줄 → 11줄. 정보는 하나도 안 버린다.
       */
      /** 앨범명 자체가 대괄호에 들어 있는 판매처가 있다(위버스샵). 그건 변형이 아니다. */
      const norm = (x) =>
        String(x || '')
          .toLowerCase()
          .replace(/[^a-z0-9가-힣]/g, '');
      const albumKey = norm(target.album);
      const variantLabel = (i) => {
        const br = (i.title || '').match(/^(?:\s*\[[^\]]+\])+/);
        if (br)
          return (br[0].match(/\[([^\]]+)\]/g) || [])
            .map((x) => x.slice(1, -1).trim())
            .filter(Boolean)
            .join(' · ');
        return (i.events || []).join(' · ');
      };
      const meaningful = (l) => {
        const n = norm(l);
        return n && n !== albumKey && !(albumKey && albumKey.includes(n) && n.length > 5);
      };
      /** 이 상품 한 장만 살 때의 배송비. 판매처별 정책은 shipping.mjs에 출처와 함께 있다. */
      const shipOf = (i) => feeFor(i.retailer, i.price ?? 0, i.freeShipping === true);
      const shipCell = (i) => {
        const f = shipOf(i);
        if (f.fee == null) return `<span class="flag">${esc(f.why || '미확인')}</span>`;
        const v = f.fee === 0 ? '<span class="ok2">무료</span>' : won(f.fee);
        return `${v}${f.unknown ? '<span class="est">추정</span>' : ''}`;
      };
      const rowGroups = new Map();
      for (const i of items) {
        const k = [i.retailer, i.price, i.soldOut === true, i.maxOrder || '', benefitCell(i)].join('§');
        if (!rowGroups.has(k)) rowGroups.set(k, []);
        rowGroups.get(k).push(i);
      }
      const cards = `<div class="wrap"><table class="cmp fx">
<colgroup><col class="c1"><col class="c2"><col class="c3"><col></colgroup><thead><tr>
<th>판매처</th><th class="num">가격</th><th class="num">배송</th><th>특전</th></tr></thead><tbody>${[...rowGroups.values()]
        /**
         * **싼 순으로 세운다.** 가격이 같으면 배송비가 갈라놓는다.
         * 상품값만 보면 알라딘(무료배송)과 케타포(3만원 미만 3,000원)가 같은 줄에 서는데
         * 실제로 내는 돈은 다르다.
         */
        .sort((a, b) => {
          // 배송비를 **모르는 것**을 0으로 치면 위버스샵(배송지에 따라 다름)이
          // 무료배송인 알라딘 바로 뒤에 선다. 모르는 건 싸다는 뜻이 아니라서 뒤로 보낸다.
          const p = (x) => x[0].price ?? 0;
          const f = (x) => shipOf(x[0]).fee ?? Number.MAX_SAFE_INTEGER;
          return p(a) - p(b) || f(a) - f(b);
        })
        .map((g) => {
          const i = g[0];
          // 변형 태그 — 한 줄로 합친 상품들이 서로 무엇이 다른지가 여기 남는다.
          // 한 줄 안에서 이미 나온 낱말은 다시 쓰지 않는다 — 애플뮤직 6종은
          // `쟈니 · 8/30 영상통화`, `태용 · 8/30 영상통화`…로 뒷말이 매번 반복된다.
          const seen = new Set();
          const said = new Set();
          const vars = [];
          for (const x of g) {
            const raw = variantLabel(x);
            const full = (meaningful(raw) ? raw : '') || (g.length > 1 ? '기본' : '');
            if (!full || seen.has(full)) continue;
            seen.add(full);
            const segs = full.split(' · ');
            const short = segs.filter((seg) => !said.has(seg)).join(' · ');
            segs.forEach((seg) => said.add(seg));
            vars.push(
              `<a class="tg" href="${esc(x.url)}" target="_blank" rel="noopener" title="${esc(full)}">${esc(short || full)}</a>`
            );
          }
          const flags = [
            i.soldOut === true ? '<span class="tg w">품절</span>' : '',
            i.maxOrder ? `<span class="tg">1인 ${i.maxOrder}장</span>` : '',
            ...vars,
          ].filter(Boolean);
          return `<tr>
<td class="rt" data-label="판매처"><a href="${esc(i.url)}" target="_blank" rel="noopener">${retailerMark(i.retailer)}${esc(i.retailer)}</a>${
            flags.length ? `<div class="tags">${flags.join('')}</div>` : ''
          }</td>
<td class="num" data-label="가격">${money(i)}</td>
<td class="num" data-label="배송">${shipCell(i)}</td>
<td class="ben" data-label="특전">${benefitCell(i)}</td></tr>`;
        })
        .join('')}</tbody></table></div>`;

      // 구성품 — 버전 선택의 실제 기준. 위버스샵이 사이즈까지 준다.
      const comp = items.find((i) => i.composition)?.composition;
      const rnd = items.find((i) => i.randomNote)?.randomNote;
      const compHtml = comp
        ? `<details class="comp"><summary>구성품 보기</summary><pre>${esc(comp)}</pre>${rnd ? `<p class="mut">${esc(rnd)}</p>` : ''}</details>`
        : '';

      const anySold = items.some((i) => i.soldOut === true);
      // 탭 배지는 "이 버전은 못 산다"로 읽힌다. 한 곳만 품절인데 달면 거짓말이 된다
      // (실측: keyring｜개별은 7곳 중 Ktown4u 한 곳뿐이었다). 전 판매처가 품절일 때만 단다.
      const allSold = items.length > 0 && items.every((i) => i.soldOut === true);
      // 판매처명을 노출한다 — `코르티스 알라딘 특전`처럼 판매처명이 붙은 쿼리가 실제로 있다(자동완성 확인)
      const shops = [...retailers].join(' · ');
      const label = ed === '기본' ? '기본반' : ed;
      return {
        label,
        pk,
        anySold,
        allSold,
        panel: `<h3>${esc(label)} <span class="pk">${esc(pk)}</span> ${badge}${
          anySold ? ' <span class="soldb">일부 품절</span>' : ''
        }</h3>
<p class="rep"><a href="#" data-report="${esc(key)}" role="button">특전 실물 사진 보내기</a><span class="rmsg mut"></span></p>
${cards}${compHtml}`,
      };
    });

  /**
   * 버전은 **쌓지 않고 넘긴다.**
   *
   * 버전 6~18종을 세로로 이어붙이면 페이지가 한없이 길어지는데, 팬은 보통 **한 버전만** 본다.
   * 나머지는 스크롤 비용일 뿐이다. NN/g 지침도 같다 — 선택지는 드롭다운에 감추지 말고
   * **전부 보이는 버튼**으로 내놓으면 선택이 15~20% 오른다.
   *
   * 패널은 전부 DOM에 남긴다. 숨기는 건 CSS라서 크롤러는 `PHOTO BOOK Ver.` 같은
   * 버전명을 그대로 읽는다 — 롱테일 검색이 1순위 채널이라 이걸 잃으면 안 된다.
   * JS가 없으면 전부 펼쳐진다(현재 동작 그대로). 탭은 덧붙이는 것이지 전제가 아니다.
   */
  /**
   * **탭은 에디션 단위다. 낱개·세트는 그 안에서 고른다.**
   *
   * 둘을 따로 탭으로 세우면 `PHOTO BOOK Ver.`가 두 개 보이고 "왜 두 개지"가 된다.
   * 포장은 같은 버전을 몇 장 묶어 파느냐의 차이라, 버전을 고른 **다음에** 정할 문제다.
   * 태민 기준 탭이 6개 → 4개로 준다.
   */
  const byEd = new Map();
  for (const p of panels) {
    if (!byEd.has(p.label)) byEd.set(p.label, []);
    byEd.get(p.label).push(p);
  }
  const tabs = [...byEd.entries()].map(([label, ps]) => ({
    label,
    allSold: ps.every((p) => p.allSold),
    packs: ps,
  }));

  const sections = tabs.length
    ? `<h2>버전별 판매처 비교 <span class="one">${tabs.length}종</span></h2>
<div class="vtabs" role="tablist">${tabs
        .map(
          (t, i) =>
            `<button type="button" class="vt${i === 0 ? ' on' : ''}" data-p="${i}" role="tab">${esc(t.label)}${
              t.allSold ? ' <span class="vtd">품절</span>' : ''
            }</button>`
        )
        .join('')}</div>
${tabs
        .map(
          (t, i) => `<div class="vp" data-p="${i}">${
            t.packs.length
              ? `<div class="psw">${t.packs
                  .map(
                    (p, j) =>
                      `<button type="button" class="pb${j === 0 ? ' on' : ''}" data-k="${j}">${esc(p.pk)}</button>`
                  )
                  .join('')}</div>`
              : ''
          }${t.packs.map((p, j) => `<div class="pp" data-k="${j}">${p.panel}</div>`).join('')}</div>`
        )
        .join('\n')}`
    : '';

  const opt = optimize(rows);
  let optHtml = '';
  if (opt?.best) {
    const bd = opt.best.breakdown
      .map(
        (b) => `<div class="dl">
<div class="dlt">${retailerMark(b.retailer)}${esc(b.retailer)} <span class="pk">${b.count}종</span></div>
<div class="dlc">${won(b.subtotal)}</div>
<div class="dlm">배송 ${
          b.fee == null
            ? `<span class="flag">${esc(b.why || '금액 미확인')}</span>`
            : b.fee === 0
              ? '무료'
              : won(b.fee)
        }${b.unknown ? '<span class="est">추정</span>' : ''}${b.coupon ? ` · 쿠폰 −${won(b.coupon)}` : ''}</div>
</div>`
      )
      .join('');
    /**
     * **여기는 표를 쓰지 않는다.**
     *
     * 바로 위 "버전별 판매처 비교"가 같은 판매처 이름이 같은 순서로 늘어선 표다.
     * 그 밑에 똑같이 생긴 표를 하나 더 두면 두 개가 무슨 관계인지 읽히지 않는다.
     * 이건 비교가 아니라 **순위**다 — 어디 한 곳에서 몇 종까지 사지고 얼마인가.
     * 그래서 등수를 매긴 목록으로 낸다. 총액이 판단 기준이니 그것만 크게 둔다.
     */
    const singleRows = opt.singles
      .map((s, n) => {
        const meta = [
          s.full ? `${opt.versions}종 전부` : `${opt.versions}종 중 ${s.count}종`,
          s.fee == null ? '배송 미확인' : s.fee === 0 ? '배송 무료' : `배송 ${won(s.fee)}`,
          s.coupon ? `쿠폰 −${won(s.coupon)}` : '',
        ]
          .filter(Boolean)
          .join(' · ');
        return `<li class="rk${s.full ? '' : ' part'}">
<span class="rkn">${n + 1}</span>
<span class="rkb">${retailerMark(s.retailer)}<b>${esc(s.retailer)}</b>
<span class="rkm">${esc(meta)}</span></span>
<span class="rkv">${won(s.sum)}${s.unknown ? '<span class="est">추정</span>' : ''}</span>
</li>`;
      })
      .join('');
    optHtml = `<h2>최저가 조합 <span class="one">${opt.versions}종</span></h2>
${
      opt.unbuyable?.length
        ? `<div class="warn"><b>${opt.unbuyable.length}종은 모든 판매처에서 품절</b>이라 계산에서 뺐습니다.
${esc(opt.unbuyable.map((u) => u.edition || u.key.split('｜')[0]).join(', ')).slice(0, 200)}.
아래 ${opt.versions}종은 지금 살 수 있는 것만 모은 결과입니다.</div>`
        : ''
    }
<div class="best"><span class="bl">최저가</span><b class="bv">${won(opt.best.sum)}</b>${
      opt.best.unknown ? '<span class="flag">일부 미확인</span>' : ''
    }<span class="bm">상품 ${won(opt.best.goods)} · 배송 ${
      opt.best.ship ? won(opt.best.ship) : '무료'
    }${opt.best.coupon ? ` · 쿠폰 −${won(opt.best.coupon)}` : ''}</span></div>
<div class="bds">${bd}</div>
${singleRows ? `<ol class="rks">${singleRows}</ol>` : ''}
`;
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

  /**
   * 문서 조립 — 나무위키 구조를 따른다.
   *   제목 + 최근 수정 시각 → 개요 → 목차 → 번호 매긴 문단 → 각주
   *
   * 상점이 아니라 자료의 형식이다. 우리 데이터는 88%가 불확실한데(FOOTNOTES 주석 참고),
   * 상점 형식은 확정을 전제하므로 그 위에 얹으면 고장난 상점처럼 보인다.
   */
  /**
   * 메인 사진 한 장 + 썸네일 줄. 썸네일로 전 버전이 한눈에 들어오고, 눌러서 넘긴다.
   * JS가 없어도 가로 스크롤로 전부 볼 수 있다 — 화살표는 JS가 있을 때만 붙는다.
   */
  /**
   * 같은 에디션의 낱개·세트는 같은 사진을 밀어넣는다(PHOTO BOOK 낱개/세트 → 위버스샵 특전 2장).
   * 갤러리에서는 같은 파일이 두 번 나오면 그냥 고장으로 읽히므로 URL로 한 번 거른다.
   */
  const galShots = allShots.filter((g, n) => allShots.findIndex((x) => x.url === g.url) === n);
  const pageGal = galShots.length
    ? `<h2>사진 <span class="one">${galShots.length}장</span></h2>
<div class="pgal"${galShots.length > 1 ? ' data-gal="1"' : ''}>
<div class="pgm">${galShots
        .map(
          (g, n) => `<figure${g.tall ? ' class="tall"' : ''}>
<a href="${esc(g.url)}" target="_blank" rel="noopener"><img src="${esc(g.url)}" alt="${esc(g.ver)} ${esc(g.cap)}" loading="${n ? 'lazy' : 'eager'}"></a>
<figcaption>${esc(g.ver)} · ${esc(g.cap)}${g.tall ? ' <b class="scr">위아래로 넘겨 보기</b>' : ''}${
            g.note ? `<span>${esc(g.note)}</span>` : ''
          }</figcaption></figure>`
        )
        .join('')}</div>
${
        galShots.length > 1
          ? `<div class="pgt">${galShots
              .map(
                (g, n) =>
                  `<button type="button" data-i="${n}" aria-label="${esc(g.ver)} ${esc(g.cap)}"><img src="${esc(g.url)}" alt="" loading="lazy"></button>`
              )
              .join('')}</div>`
          : ''
      }</div>`
    : '';

  const body = `${countdownHtml(deadlines, slug, siteUrl, `${artistName} ${target.album}`, rows.find((r) => r.thumb)?.thumb)}
${sections || '<p>수집된 상품이 없습니다.</p>'}
${pageGal}
${optHtml}
${eventsHtml(events, eventTotal)}
${faqHtml({ artistName, album: target.album, retailerNames, best: opt?.best, versions: groups.length })}`;

  return shell(
    `${artistName} ${target.album} 판매처별 특전 | 버전·구성·가격`,
    `${siteHeader(stamp, { href: '../index.html' })}
${expiredBanner(expired, target)}
<a class="back" href="../index.html">← 전체 컴백</a>
<h1>${esc(artistName)} <span class="alb">${esc(target.album)}</span></h1>
${reportJs(slug)}
${body}
${/class="vtabs"/.test(body) ? VIEW_JS : ""}
${errors?.length ? `<div class="err">수집 실패: ${errors.map(esc).join(' / ')}</div>` : ''}
<p class="stamp">최근 수집 <b>${esc(stamp)}</b></p>`,
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
 * 키 정규화가 깨진 값이 섞여 들어온다 — `ohitx27shot`(작은따옴표가 `&#x27;`로 escape된 뒤 남은 x27)
 * 같은 것들. 그걸 그대로 배지에 띄우면 안 된다.
 *
 * `unnaturalvergazedverbreak`는 **깨진 값이 아니다.** 실제로 3종 세트
 * (`edition: "Unnatural+Gazed+Break ver."`)라 고치면 안 된다.
 * **고칠 곳은 여기가 아니라 수집 쪽(fetchx.mjs의 3축 정규화)이다.** 여기서는 못 읽을 값만 감춘다.
 */
/** "2026-08-25" → "8월 25일". 목록에서 연도는 노이즈다 — 예판 중인 앨범은 전부 올해다. */
const krDate = (s) => {
  const m = String(s || '').match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? `${Number(m[2])}월 ${Number(m[3])}일` : String(s || '');
};

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
   * 격자는 균일하다. 한 장만 키우는 초점 카드를 뒀다가 뺐다 —
   * 격자에 구멍이 뚫린 것처럼 보였고, 둘로 늘리면 "왜 저 둘인가"에 답이 없어진다.
   * 29CM 상품 격자도 균일하다. 저쪽은 카드 크기가 아니라 **섹션**으로 강조한다.
   *
   * 대신 **마감이 급한 순으로 정렬**해서 가장 급한 것이 좌상단에 온다 —
   * 구텐베르크 도해상 눈이 먼저 닿는 자리다(docs/38-조사-배치원리.md).
   * 크기로 외치지 않고 순서로 말한다.
   */
  const at = (a) => (a.nextDeadline?.at ? new Date(a.nextDeadline.at).getTime() : Infinity);
  const ordered = [...albums].sort((x, y) => Number(!!x.expired) - Number(!!y.expired) || at(x) - at(y));

  // 검색 대상 문자열을 빌드 때 미리 만들어 카드에 박는다 (브라우저는 비교만 한다)
  const hayOf = (a) => [a.artistDisplay, a.artist, a.artistKo, a.album].filter(Boolean).join(' ');
  /**
   * 카드는 링크가 아니라 상자다. 커버 스트립 안에 점(button)이 들어가는데
   * `<a>` 안에 `<button>`을 넣을 수 없어서다. 대신 `.go`가 카드 전체를 덮는다.
   */
  const cards = ordered
    .map((a, i) => {
      // 태그 — 29CM 상품 카드 방식. 테두리 알약이 아니라 회색 배경 채움이다(실측: radius 2px).
      // 경고(품절)만 액센트를 쓴다 — 액센트가 한 곳뿐이라 그게 바로 눈에 띈다.
      const tg = [
        /**
         * benefitCount는 "특전을 주는 곳"이 아니라 **내용까지 확인된 판매처 수**다.
         * (build.mjs: benefit 배열이 채워진 row의 판매처 유일값)
         * 구성 비공개(secret)·확인 못함(unknown)은 빠지므로 실제보다 적게 잡힌다.
         *
         * 그래서 "3곳"이라고 단정하지 않고 **전체 판매처 대비 분수**로 쓴다 — `특전 3/7`.
         * 단위("곳")를 억지로 붙이지 않아도 되고, 7곳 중 3곳이라는 정보가 덤으로 붙는다.
         */
        a.benefitCount ? `<span class="tg">특전 ${a.benefitCount}/${a.retailers}</span>` : '',
        a.fansignCount ? '<span class="tg">팬사인회</span>' : '',
        // soldCount는 버전이 아니라 **상품(판매처×버전) 단위**라 "종"이 아니라 "건"이다.
        a.soldCount ? `<span class="tg w">품절 ${a.soldCount}건</span>` : '',
      ]
        .filter(Boolean)
        .join('');
      return `<div class="card" data-q="${esc(searchKey(hayOf(a)))}" data-c="${esc(
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
  // **항상 낸다.** 조건부로 냈더니 어떤 카드엔 있고 어떤 카드엔 없어서 깨져 보였다.
  // 실측상 예판 중인 앨범은 전부 발매일이 있다(14/14).
  a.deliveryDate ? `${esc(krDate(a.deliveryDate))} 발매` : '',
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
    // 검색 결과에 뜨는 문구다. 키워드는 담되 `A — B·C·D` 나열은 쓰지 않는다.
    'K-POP 앨범 판매처별 특전 비교 | 버전·구성·가격 한눈에',
    `${siteHeader(stamp)}
${
      // 한 화면에 다 들어오면 검색창이 방해만 된다. 카드가 늘어난 뒤에만 낸다.
      albums.length >= 8
        ? `<div class="find" style="display:none">
<input id="q" type="search" placeholder="아티스트·앨범 검색 · 초성도 됩니다 (ㅌㅁ → 태민)" autocomplete="off" spellcheck="false">
<span class="n" id="qn"></span></div>
<p class="none-hit" id="qz" style="display:none">찾는 앨범이 없습니다. 예약판매 중인 것만 올라옵니다.</p>`
        : ''
    }
<div class="cards">${cards}</div>
<details class="ft">
<summary>이 사이트는 무엇인가</summary>
<div class="body">위버스샵 · 알라딘 · Ktown4u · 사운드웨이브 · 위드뮤 · 뮤직플랜트 · 애플뮤직에서 자동으로 모읍니다.
앨범 <b>${live}</b>개가 예약판매 중이고, 같은 앨범이라도 <b>버전마다 구성이 다르고 어디서 사느냐에 따라 받는 포토카드가 다릅니다.</b>${
      albums.some((a) => a.nextDeadline)
        ? ` 마감이 걸린 앨범은 남은 시간이 함께 표시됩니다.<br>${
            siteUrl
              ? `<a href="${esc(siteUrl.replace(/^https?:/, 'webcal:'))}/alarm.ics">전체 마감 캘린더 구독하기</a> <span class="mut">캘린더가 알아서 갱신됩니다</span>${pushHtml(vapidPublicKey)}`
              : `<a href="alarm.ics" download>전체 마감 캘린더 내려받기 (.ics)</a>${pushHtml(vapidPublicKey)}`
          }`
        : ''
    }</div>
</details>
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
