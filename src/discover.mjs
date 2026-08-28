import * as wev from './weverse.mjs';

/**
 * 동시 실행 제한.
 *
 * 실패 건수를 반드시 밖으로 알린다. 조용히 null로 만들면 "요청이 실패했다"와
 * "예판이 없다"가 똑같이 보이고, watch.mjs는 그걸 **예판 종료**로 오인해
 * 없던 변화를 만들어낸다 (다음 회차엔 다시 "새 예판"으로 뜬다).
 */
async function pool(items, n, fn) {
  const out = [];
  let failed = 0;
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        try {
          out[idx] = await fn(items[idx], idx);
        } catch {
          out[idx] = null;
          failed++;
        }
      }
    })
  );
  return { out, failed };
}

// 대괄호 안에 이런 말이 들어 있으면 앨범명이 아니라 이벤트·특전 표식이다
const EVENTISH =
  /LIVE|GIFT|EVENT|PARTY|DRAW|SIGN|FANSIGN|CHOOM|SHOWCASE|BIRTHDAY|TIMA|COMEBACK|YOUTUBE|SPECIAL|BENEFIT|UNBOXING|POP-?UP|응모|사인회|영상통화/i;

/** 상품명에서 앨범 제목을 추정한다 (버전·이벤트 표기를 걷어냄) */
function albumTitleOf(name) {
  let t = ' ' + String(name || '').replace(/\s+/g, ' ') + ' ';
  // "A + A Set" 같은 결합 상품은 같은 앨범이다 — 첫 항목만 남긴다
  t = t.replace(/\s\+\s.*$/, ' ');
  t = t
    .replace(/\((?:[^()]{0,30}(?:Ver\.?|Version|Set|Random)[^()]{0,10})\)/gi, ' ')
    .replace(/\[[^\][]{0,30}(?:Ver\.?|Set|세트|CD SET)[^\][]{0,10}\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 대괄호 후보 중 이벤트성이 아닌 첫 번째를 앨범명으로 본다
  const brackets = [...t.matchAll(/\[([^\][]{2,80})\]?/g)].map((m) => m[1].trim());
  const real = brackets.find((b) => !EVENTISH.test(b));
  if (real) return real;

  // 대괄호가 전부 이벤트성이면, 그것들을 지우고 남는 텍스트에서 아티스트명 뒤를 취한다
  let rest = t.replace(/\[[^\][]{0,80}\]?/g, ' ').replace(/\s+/g, ' ').trim();
  rest = rest.replace(/^[^-]{0,40}-\s*/, '').trim(); // "아티스트 - " 제거
  return rest || brackets[0] || '';
}

/** 실제 아티스트가 아닌 위버스샵 내부 카테고리 */
const VIRTUAL_ARTIST = /More Artist|Weverse Lucky Store|Weverse Shop/i;

/**
 * 위버스샵 전 아티스트를 훑어 예약판매(PRE_ORDER) 중인 앨범을 찾는다.
 * icons에 PRE_ORDER가 있으면 예판, BENEFIT이 있으면 특전 있음.
 */
export async function discoverPreorders({ concurrency = 6, limitArtists = 0 } = {}) {
  const artists = await wev.artists();
  const list = (limitArtists ? artists.slice(0, limitArtists) : artists).filter((a) => !VIRTUAL_ARTIST.test(a.name));

  const { out: perArtist, failed } = await pool(list, concurrency, async (a) => {
    const cards = await wev.listSales(a.artistId);
    // 예판(PRE_ORDER) + 음반(albumChartTargets가 있으면 한터/써클 반영 = 실제 앨범).
    // 이 조건 하나로 MD·포토북·이벤트 상품이 전부 걸러진다.
    const pre = (cards || []).filter(
      (c) => (c.icons || []).includes('PRE_ORDER') && (c.albumChartTargets || []).length > 0
    );
    if (!pre.length) return null;

    // 앨범 단위로 묶는다
    const albums = new Map();
    for (const c of pre) {
      const title = albumTitleOf(c.name);
      if (!title) continue;
      if (!albums.has(title)) albums.set(title, { album: title, skus: [], benefit: false, deliveryDate: null });
      const g = albums.get(title);
      g.skus.push({ saleId: c.saleId, name: c.name, price: c.price?.salePrice ?? null, icons: c.icons || [] });
      if ((c.icons || []).includes('BENEFIT')) g.benefit = true;
      if (c.deliveryDate && (!g.deliveryDate || c.deliveryDate < g.deliveryDate)) g.deliveryDate = c.deliveryDate;
    }
    return { artistId: a.artistId, artistEn: a.name, shortName: a.shortName, albums: [...albums.values()] };
  });

  const found = perArtist.filter(Boolean);
  const rows = [];
  for (const a of found) {
    for (const al of a.albums) {
      rows.push({
        artistId: a.artistId,
        artistEn: a.artistEn,
        album: al.album,
        skuCount: al.skus.length,
        benefit: al.benefit,
        deliveryDate: al.deliveryDate ? al.deliveryDate.slice(0, 10) : null,
        // **위버스샵 SKU만 본 값이다.** 이 단계에서는 다른 판매처를 아직 안 긁었다.
        // 이름이 priceMin이면 "이 앨범의 전체 최저가"로 읽혀서, 실제로 16개 중 5개가
        // 교차 판매처 최저가와 어긋났다(예: 투바투 13,300 vs 실제 11,600).
        // 화면에 쓰이는 값이 아니라 고치는 대신 이름을 사실대로 바꾼다.
        weversePriceMin: Math.min(...al.skus.map((s) => s.price ?? Infinity)),
      });
    }
  }
  // 특전 있는 것 → 버전 많은 것 순
  rows.sort((x, y) => Number(y.benefit) - Number(x.benefit) || y.skuCount - x.skuCount);
  // failed는 호출자가 반드시 봐야 한다 — 스캔이 불완전하면 "사라졌다"를 믿으면 안 된다
  return { artistCount: list.length, artistsWithPreorder: found.length, failed, albums: rows };
}
