/* js/textfit.js — safe-area garantili metin yerleşimi (asla kırpmaz)
 *
 * 1080×1920 video için güvenli alan:
 *   sol 120 · sağ 120 · üst 140 · alt 160
 *
 * Sıra:
 *   1) Kelime bazlı sar (kelime ortasından bölme yok)
 *   2) Satır genişliği / blok yüksekliği maxWidth/maxHeight ile doğrulanır
 *   3) Sığmıyorsa font küçültülür
 *   4) Min fontta bile sığmayan TEK kelime varsa (patolojik) güvenli
 *      karakter kırması yapılır — kırpma asla olmaz
 *   5) Hâlâ sığmıyorsa overflow=true döner → üst katman sahneyi böler
 *      veya üretimi engeller (sorun gizlenmez)
 */

export const SAFE = { left: 120, right: 120, top: 140, bottom: 160 };
export const VIDEO_W = 1080;
export const VIDEO_H = 1920;

export function safeArea() {
  return {
    x: SAFE.left,
    y: SAFE.top,
    w: VIDEO_W - SAFE.left - SAFE.right,
    h: VIDEO_H - SAFE.top - SAFE.bottom,
  };
}

/** ctx.letterSpacing destekleniyorsa measureText onu içerir; desteklenmiyorsa
 *  çizim de tracking uygulamaz → ölçü her iki durumda da doğrudur. */
export function measureWidth(ctx, text) {
  return ctx.measureText(text).width;
}

/**
 * Kelime bazlı sar. Hiçbir satır maxWidth'i aşamaz:
 * tek kelime bile genişse (patolojik durum) güvenli karakter kırması yapılır.
 * Çağıran ctx.font'u önceden ayarlamalıdır (ve isterse ctx.letterSpacing).
 */
export function wrapLinesStrict(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (measureWidth(ctx, w) > maxWidth) {
      if (line) { lines.push(line); line = ''; }
      let chunk = '';
      for (const ch of w) {
        const t2 = chunk + ch;
        if (chunk && measureWidth(ctx, t2) > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk = t2;
        }
      }
      if (chunk) line = chunk;
      continue;
    }
    const test = line ? line + ' ' + w : w;
    if (!line || measureWidth(ctx, test) <= maxWidth) {
      line = test;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Metin bloğunu güvenli kutuya sığdırır.
 * @returns {{size:number, lines:string[], width:number, height:number,
 *            lineHeight:number, overflow:boolean}}
 *   overflow=true → min fontta bile sığmıyor (sahne bölme/engelleme üst katmanda).
 */
export function fitBlock(ctx, text, opts = {}) {
  const {
    maxWidth = 840, maxHeight = 1200,
    base = 42, min = 22,
    weight = 600, font = 'Inter',
    lineHeight = 1.5, maxLines = 26,
  } = opts;
  if (!text || !String(text).trim()) {
    return { size: base, lines: [], width: 0, height: 0, lineHeight, overflow: false };
  }
  const fits = (size) => {
    ctx.font = `${weight} ${size}px ${font}, sans-serif`;
    const lines = wrapLinesStrict(ctx, text, maxWidth);
    if (!lines.length) return null;
    let width = 0;
    for (const l of lines) width = Math.max(width, measureWidth(ctx, l));
    const height = lines.length * size * lineHeight;
    if (width <= maxWidth + 0.5 && height <= maxHeight + 0.5 && lines.length <= maxLines) {
      return { size, lines, width, height, lineHeight, overflow: false };
    }
    return null;
  };
  for (let size = base; size >= min; size -= 2) {
    const r = fits(size);
    if (r) return r;
  }
  // min fontta da sığmıyor → overflow işareti (kırpma YOK — satırlar yine maxWidth içinde)
  const size = min;
  ctx.font = `${weight} ${size}px ${font}, sans-serif`;
  const lines = wrapLinesStrict(ctx, text, maxWidth);
  let width = 0;
  for (const l of lines) width = Math.max(width, measureWidth(ctx, l));
  const height = lines.length * size * lineHeight;
  return {
    size, lines, width, height, lineHeight,
    overflow: height > maxHeight + 0.5 || lines.length > maxLines,
  };
}

/** Yerleştirilmiş bloğun gerçek bounding box'ı (kırpma denetimi için) */
export function blockBox(fit, { x, y, align = 'center' } = {}) {
  const size = fit.size;
  const lh = size * fit.lineHeight;
  const ascent = size * 0.82;
  const descent = size * 0.26;
  let left = x, right = x;
  if (align === 'center') { left = x - fit.width / 2; right = x + fit.width / 2; }
  else if (align === 'right') { left = x - fit.width; right = x; }
  else { left = x; right = x + fit.width; }
  const top = y - ascent;
  const bottom = y + (fit.lines.length - 1) * lh + descent;
  return { left, right, top, bottom, width: fit.width, height: bottom - top };
}

/** Kutu safe-area içinde mi? */
export function withinSafe(box) {
  return (
    box.left >= SAFE.left - 0.5 &&
    box.right <= VIDEO_W - SAFE.right + 0.5 &&
    box.top >= SAFE.top - 0.5 &&
    box.bottom <= VIDEO_H - SAFE.bottom + 0.5
  );
}
