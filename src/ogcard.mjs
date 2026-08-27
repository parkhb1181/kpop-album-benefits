/**
 * OG 공유 카드 — 링크를 카톡·X에 퍼갔을 때 뜨는 1200×630 미리보기 그림.
 *
 * 왜 굽는가. 유입은 ①검색 ②팬이 링크를 퍼가는 것 둘인데(seo.mjs 참고),
 * ②에서 지금까지 **판매처가 만든 특전 안내 이미지를 그대로 물려 왔다.**
 * 그건 세로로 긴 배너라(실측 720×1525) 가로 1.91:1 카드에서 가운데 띠만 잘려 나오고,
 * 무엇보다 우리가 수집한 정보가 하나도 안 담긴다. 남의 상품 사진을 우리 이름으로 퍼가는 셈이다.
 *
 * 의존성 셋(satori·resvg·sharp)이 없으면 조용히 null을 돌려준다 —
 * 위드뮤/playwright와 같은 규칙이다. 카드가 없다고 빌드가 죽으면 안 된다.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { optimize } from './optimize.mjs';

const require = createRequire(import.meta.url);

const ACC = '#8c2f14';
const NEUTRAL = '#f4f1ec'; // 가장자리가 균일하지 않은 커버(통짜 아트)용 폴백

let mods = null; // { satori, Resvg, sharp, fonts }
let disabled = false;

async function load() {
  if (mods || disabled) return mods;
  try {
    const [{ default: satori }, { Resvg }, { default: sharp }] = await Promise.all([
      import('satori'),
      import('@resvg/resvg-js'),
      import('sharp'),
    ]);
    const dir = join(require.resolve('pretendard/package.json'), '..', 'dist/public/static/alternative');
    const w = (file, weight) => ({
      name: 'Pretendard',
      weight,
      style: 'normal',
      data: readFileSync(join(dir, file)),
    });
    mods = {
      satori,
      Resvg,
      sharp,
      fonts: [
        w('Pretendard-Regular.ttf', 400),
        w('Pretendard-Medium.ttf', 500),
        w('Pretendard-SemiBold.ttf', 600),
        w('Pretendard-Bold.ttf', 700),
        w('Pretendard-ExtraBold.ttf', 800),
      ],
    };
    return mods;
  } catch (e) {
    disabled = true;
    console.log(`⚠ OG 카드 비활성 (${e.message.split('\n')[0]}) — og:image는 판매처 이미지로 폴백합니다`);
    return null;
  }
}

/**
 * 커버 가장자리 색을 찍는다.
 *
 * 판매처 썸네일은 대개 흰 배경 위의 상품 사진인데 **그 흰색이 판매처마다 다르다** —
 * 실측: 케타포 태민 #ffffff, 코르티스 #f7f7f7. 패널을 흰색으로 고정하면 둘 중 하나는
 * 반드시 세로 경계선이 보인다. 그래서 고정하지 않고 커버에서 뽑는다.
 *
 * 가장자리가 균일할 때만 채택한다. 통짜 아트면 제각각이라 폴백으로 간다.
 */
async function plateColor(sharp, buf) {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: ch } = info;
  const at = (x, y) => {
    const i = (y * W + x) * ch;
    return [data[i], data[i + 1], data[i + 2]];
  };

  const edge = [];
  for (let x = 0; x < W; x += 2) edge.push(at(x, 1), at(x, H - 2));
  for (let y = 0; y < H; y += 2) edge.push(at(1, y), at(W - 2, y));

  const avg = edge.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => v / edge.length);
  const off = edge.filter((p) => Math.max(...p.map((v, i) => Math.abs(v - avg[i]))) > 10).length / edge.length;
  if (off > 0.1) return NEUTRAL;

  return '#' + avg.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/** 배경색에서 먹·회색·괘선을 파생한다 — 배경이 어두우면 자동으로 뒤집힌다 */
function palette(bg) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const ink = lum > 0.55 ? [23, 21, 15] : [246, 244, 239];
  const mix = (t) =>
    '#' + [r, g, b].map((c, i) => Math.round(c + (ink[i] - c) * t).toString(16).padStart(2, '0')).join('');
  return { paper: bg, ink: mix(1), body: mix(0.82), mut: mix(0.55), rule: mix(0.14), acc: ACC };
}

const div = (style, children) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children } });
const txt = (style, s) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children: s } });

/**
 * 레이아웃.
 *
 * 문장을 쓰지 않는다 — "전 6종 모으기 최저" 같은 구절 대신 "최저" 한 단어다.
 * 액센트는 품절 한 군데만 쓴다. 금액은 검정이 더 강하다.
 * 한글에 letterSpacing을 주면 단어 사이 공백이 죽는다("판매처별특 전 비교"). 숫자에만 쓴다.
 */
function card(d) {
  const C = d.C;
  return div({ width: 1200, height: 630, background: C.paper, color: C.ink }, [
    { type: 'img', props: { src: d.cover, width: 630, height: 630, style: { objectFit: 'cover' } } },
    div({ width: 570, flexDirection: 'column', justifyContent: 'center', padding: '46px 46px 42px' }, [
      txt({ fontSize: 20, fontWeight: 500, color: C.mut }, d.artist),
      txt(
        { fontSize: d.album.length > 20 ? 42 : 48, fontWeight: 700, lineHeight: 1.12, letterSpacing: -1, marginTop: 4 },
        d.album
      ),

      div({ height: 1, background: C.rule, marginTop: 28 }, []),

      div({ marginTop: 22, fontSize: 20, color: C.body }, [
        txt({}, `판매처 ${d.retailers}`),
        txt({ marginLeft: 28 }, `버전 ${d.versions}`),
        ...(d.sold ? [txt({ marginLeft: 28, color: C.acc, fontWeight: 600 }, `품절 ${d.sold}`)] : []),
      ]),

      ...(d.best
        ? [
            div({ alignItems: 'baseline', marginTop: 12 }, [
              txt({ fontSize: 20, color: C.mut, marginRight: 12 }, '최저'),
              txt({ fontSize: 56, fontWeight: 800, letterSpacing: -1.8, lineHeight: 1.1 }, d.best),
              txt({ fontSize: 26, fontWeight: 700, marginLeft: 4 }, '원'),
            ]),
          ]
        : []),

      div({ justifyContent: 'space-between', marginTop: 30, fontSize: 15, color: C.mut }, [
        txt({}, d.names),
        txt({}, d.date),
      ]),
    ]),
  ]);
}

/**
 * 해시 대장.
 *
 * out/은 저장소에 커밋된다. 카드를 매 빌드 새로 구우면 앨범 15~30개 × 160KB가
 * **하루 두 번 통째로 새 blob이 되어** 저장소가 빠르게 부푼다.
 * 그래서 내용이 바뀐 앨범만 다시 굽는다.
 *
 * 날짜는 해시에서 뺐다 — 넣으면 매일 전부 다시 구워져 이 장치가 무력해진다.
 * 그래서 카드에 찍히는 날짜는 "오늘"이 아니라 **그 앨범 정보가 마지막으로 바뀐 날**이다.
 * 신선도 표시로는 그쪽이 오히려 정확하다.
 */
function hashesFor(dir) {
  const path = join(dir, 'hashes.json');
  let map = {};
  try {
    map = JSON.parse(readFileSync(path, 'utf8'));
  } catch {}
  return { map, save: () => writeFileSync(path, JSON.stringify(map, null, 2), 'utf8') };
}

/**
 * 앨범 하나의 카드를 굽는다.
 * @returns 'written' | 'skipped' | null(못 구움)
 */
export async function renderCard({ slug, artist, album, rows, outDir = './out/og', hashes, shortDate }) {
  const m = await load();
  if (!m) return null;

  const cover = rows.find((r) => r.thumb)?.thumb;
  if (!cover) return null;

  const opt = optimize(rows);
  const d = {
    artist,
    album,
    retailers: new Set(rows.map((r) => r.retailer)).size,
    versions: new Set(rows.map((r) => r.key)).size,
    sold: rows.filter((r) => r.soldOut === true).length,
    best: opt?.best?.sum != null ? opt.best.sum.toLocaleString() : null,
    names: [...new Set(rows.map((r) => r.retailer))].join(' '),
    coverUrl: cover,
  };

  const key = createHash('sha1').update(JSON.stringify(d)).digest('hex').slice(0, 16);
  const file = join(outDir, `${slug}.png`);
  if (hashes?.map[slug] === key && existsSync(file)) return 'skipped';

  let buf;
  try {
    const res = await fetch(cover, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    buf = Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }

  const mime = /\.png(\?|$)/i.test(cover) ? 'image/png' : 'image/jpeg';
  d.cover = `data:${mime};base64,${buf.toString('base64')}`;
  d.C = palette(await plateColor(m.sharp, buf));
  d.date = shortDate;

  const svg = await m.satori(card(d), { width: 1200, height: 630, fonts: m.fonts });
  const png = new m.Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();

  mkdirSync(outDir, { recursive: true });
  writeFileSync(file, png);
  if (hashes) hashes.map[slug] = key;
  return 'written';
}

export { hashesFor };
