/* Yardımcı işlevler */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const clamp01 = (p) => clamp(p, 0, 1);
export const lerp = (a, b, p) => a + (b - a) * p;

export const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
export const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
export const easeOutQuint = (p) => 1 - Math.pow(1 - p, 5);

export function fmtClock(sec, withTenths = false) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (withTenths) {
    const t = Math.floor((sec % 1) * 10);
    return `${m}:${String(s).padStart(2, '0')}.${t}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function wordsOf(s) {
  return s && s.trim() ? s.trim().split(/\s+/).length : 0;
}

/** Konuşma hızı varsayımı: ~2.7 kelime/sn (Türkçe duyuru okuması) */
export function estimateSeconds(words) {
  return Math.max(5, Math.ceil(words / 2.7));
}

export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function debounce(fn, ms = 300) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function loadJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Büyük dosyaları ilerleme bildirimiyle indirir (model dosyaları için) */
export async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`İndirme başarısız (${res.status}): ${url}`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body || !total) {
    const blob = await res.blob();
    onProgress && onProgress(1);
    return blob;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress && onProgress(loaded / total);
  }
  return new Blob(chunks, { type: res.headers.get('content-type') || 'application/octet-stream' });
}

export function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Metni hedef kutuya sığacak en büyük font boyutunu döndürür */
export function fitFontSize(ctx, text, { maxWidth, maxHeight, base, min = 24, lineHeight = 1.18, weight = 700, font = 'Space Grotesk' }) {
  let size = base;
  for (; size > min; size -= 2) {
    ctx.font = `${weight} ${size}px ${font}, sans-serif`;
    const lines = wrapLines(ctx, text, maxWidth);
    const h = lines.length * size * lineHeight;
    if (h <= maxHeight && lines.length <= 24) return { size, lines };
  }
  ctx.font = `${weight} ${size}px ${font}, sans-serif`;
  return { size, lines: wrapLines(ctx, text, maxWidth) };
}

export function once(fn) {
  let done = false;
  return (...args) => {
    if (done) return;
    done = true;
    return fn(...args);
  };
}
