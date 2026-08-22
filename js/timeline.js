/* MASTER TIMELINE — ses, metin, sahne ve animasyon için TEK zaman çizelgesi.
 *
 * TTS'ten gelen gerçek kelime zamanlamaları (word timestamps) anlamlı
 * phrase segmentlerine dönüştürülür ve sahne sınırları bu zamanlara bağlanır:
 *
 *   "Sayın velilerimiz"  → title sahnesi (greeting)
 *   "25 Eylül Perşembe"  → date sahnesi
 *   "14.30'da"           → time sahnesi
 *   "okulumuzda"         → location sahnesi
 *   "veli toplantısı"    → message sahnesinde vurgulu satır (event)
 *
 * Kelime zamanlaması yoksa (kayıt/dosya sesi) cümle/paragraf bazlı tahmini
 * dağılım kullanılır ve timing: 'approx' olarak işaretlenir — asla sahte
 * "gerçek" gösterilmez.
 */

import { wordsOf, estimateSeconds } from './utils.js';
import { buildScenes } from './scenes.js';

export const PHRASE_RULES = {
  greeting: /^(sayın|sevgili|değerli|muhterem|kıymetli|velilerimiz|veliler|anne|babalar|ebeveynler)$/i,
  date: /(eylül|ekim|kasım|aralık|ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar|yarın|bugün)/i,
  time: /\b\d{1,2}[:.]\d{2}\b/,
  location: /(okulumuzda|okulumuzun|okulda|salonunda|salonuna|salon|müzesine|müzede|müzeye|bahçesinde|bahçesine)/i,
  event: /(toplantı|gezi|konser|şenlik|tören|yarışma|sınav|karne|duyuru|çalışma|kurs|etkinlik|davet)/i,
};

const DISPLAY_STRIP = /(?:'|\u2019)?(da|de|dan|den|nın|nin|nun|nün|na|ne|yı|yi|yu|yü|dır|dir|dur|dür)$/i;

export function normalizeWord(w) {
  return (w || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\wçğıöşüÇĞİÖŞÜ]+/g, '');
}

function classify(raw, norm) {
  if (!norm) return 'message';
  if (PHRASE_RULES.greeting.test(norm)) return 'greeting';
  if (PHRASE_RULES.time.test(raw)) return 'time';
  if (PHRASE_RULES.event.test(norm)) return 'event';
  if (PHRASE_RULES.location.test(norm)) return 'location';
  if (PHRASE_RULES.date.test(norm)) return 'date';
  if (/^\d+$/.test(norm)) return 'number'; // sayı — bağlamla date olabilir
  return 'message';
}

/** Ekranda gösterilecek metin (senkron kuralına uygun biçim) */
export function displayText(phrase, fields = {}) {
  const raw = phrase.words.map((w) => w.text).join(' ');
  switch (phrase.type) {
    case 'time': {
      // "14.30'da" → "14:30"
      const m = raw.match(/\d{1,2}[:.]\d{2}/);
      if (m) return m[0].replace('.', ':');
      return raw.toLocaleUpperCase('tr-TR').replace(DISPLAY_STRIP, '');
    }
    case 'event':
      return (fields.title || raw).toLocaleUpperCase('tr-TR');
    case 'greeting':
      return raw.toLocaleUpperCase('tr-TR').replace(DISPLAY_STRIP, '');
    case 'date':
    case 'location':
      return raw.toLocaleUpperCase('tr-TR').replace(DISPLAY_STRIP, '');
    default:
      return raw;
  }
}

/**
 * Kelimeleri phrase segmentlerine çevirir.
 * @param {Array<{word:string,start:number,end:number}>} words
 * @returns {Array<{type:string,text:string,display:string,start:number,end:number,words:Array}>}
 */
export function wordsToPhrases(words, fields = {}) {
  const seq = words
    .filter((w) => w && w.word && isFinite(w.start) && isFinite(w.end))
    .map((w) => ({ text: String(w.word), norm: normalizeWord(String(w.word)), start: +w.start, end: +w.end }));

  const classified = seq.map((w, i) => {
    let type = classify(w.text, w.norm);
    // sayı: ardından ay/gün geliyorsa tarih, değilse mesaj
    if (type === 'number') {
      const next = seq[i + 1];
      type = next && PHRASE_RULES.date.test(next.norm) ? 'date' : 'message';
    }
    // selamlama yalnızca metnin başında sayılır
    if (type === 'greeting' && i > 5) type = 'message';
    return { ...w, type };
  });

  // ardışık aynı tipi birleştir
  const phrases = [];
  for (const w of classified) {
    const last = phrases[phrases.length - 1];
    if (last && last.type === w.type && last.end >= w.start) {
      last.end = w.end;
      last.words.push({ text: w.text, start: w.start, end: w.end });
      last.text = last.words.map((x) => x.text).join(' ');
    } else {
      phrases.push({
        type: w.type,
        text: w.text,
        start: w.start,
        end: w.end,
        words: [{ text: w.text, start: w.start, end: w.end }],
      });
    }
  }
  return phrases.map((p) => ({ ...p, display: displayText(p, fields) }));
}

/**
 * Master timeline üretir.
 * @param {object} opts
 * @param {object} opts.fields
 * @param {number} opts.audioDuration
 * @param {Array} opts.words
 * @param {string|null} opts.timing 'word' | 'approx' | null
 * @returns {{scenes:Array, phrases:Array, videoDuration:number, timing:string|null}}
 */
export function buildMasterTimeline({ fields, audioDuration, words, timing = null }) {
  const D = Math.max(2, audioDuration || 10);
  const phrases = words && words.length ? wordsToPhrases(words, fields) : [];
  const real = !!phrases.length;

  if (!real) {
    // Kelime zamanlaması yok: cümle bazlı tahmini dağılım (approx)
    return estimateTimeline({ fields, audioDuration: D });
  }

  const byType = (t) => phrases.find((p) => p.type === t);
  const greeting = byType('greeting');
  const dateP = byType('date');
  const timeP = byType('time');
  const locationP = byType('location');
  const eventP = byType('event');
  const first = phrases[0];
  const last = phrases[phrases.length - 1];

  const pad = 0.25;
  const scenes = [];
  const push = (type, start, end) => {
    const dur = Math.max(0.3, end - start);
    scenes.push({ id: type, type, start, end: start + dur, dur, animation: type });
  };

  // intro: ses başlamadan önce okul kimliği
  const introEnd = Math.max(0.5, first.start - 0.2);
  push('intro', 0, introEnd);

  // title: selamlama anında "SAYIN VELİLERİMİZ"
  const afterGreeting = [dateP, timeP, locationP, eventP].filter(Boolean).map((p) => p.start);
  const titleStart = greeting ? greeting.start : first.start;
  const firstSpecial = afterGreeting.length ? Math.min(...afterGreeting) : null;
  let titleEnd;
  if (greeting) {
    // title selamlama bitimine kadar; ama ilk özel sahne (tarih vb.) başlıyorsa ona yol ver
    titleEnd = firstSpecial != null
      ? Math.max(Math.min(greeting.end + 0.6, firstSpecial), titleStart + 0.9)
      : greeting.end + 1.2;
  } else {
    titleEnd = firstSpecial != null
      ? Math.max(Math.min(first.end + 1.6, firstSpecial), titleStart + 0.9)
      : first.end + 2.0;
  }
  push('title', titleStart, titleEnd);
  scenes.find((s) => s.type === 'title').phrase = greeting || null;

  // date / time / location sahneleri: phrase'in konuşulduğu an
  let cursor = titleEnd;
  const specials = [dateP, timeP, locationP].filter(Boolean);
  const specialPhrases = [];
  for (const p of specials) {
    if (p.start < cursor - 0.1) continue; // title ile çakışıyorsa message içinde satır olur
    push(p.type, Math.max(cursor, p.start), Math.max(p.end + pad, cursor + 0.8));
    scenes.find((s) => s.type === p.type).phrase = p;
    cursor = scenes[scenes.length - 1].end;
    specialPhrases.push(p);
  }

  // message: kalan phrase'ler (event dahil) — satırlar phrase zamanlarıyla belirir
  const linePhrases = phrases.filter(
    (p) => !specialPhrases.includes(p) && p.type !== 'greeting' && p !== greeting,
  );
  // özel sahnelerden (date/time/location) SONRA başlar; erken bağlaç kelimeler
  // burada anında belirir, vurgulu öğeler yine kendi zamanlarında açılır
  const msgStart = cursor;
  const msgEnd = Math.max(...linePhrases.map((p) => p.end), last.end) + 0.35;
  push('message', msgStart, msgEnd);
  scenes.find((s) => s.type === 'message').phrases = linePhrases;

  // outro
  push('outro', msgEnd, msgEnd + 1.8);

  const videoDuration = scenes[scenes.length - 1].end + 0.5;
  return {
    scenes,
    phrases: linePhrases,
    videoDuration,
    timing: real ? timing || 'word' : null,
  };
}

/** Kelime zamanlaması yokken cümle bazlı tahmini dağılım (approx) */
function estimateTimeline({ fields, audioDuration }) {
  const hasDate = !!(fields.date || '').trim();
  const hasTime = !!(fields.time || '').trim();
  const hasLocation = !!(fields.location || '').trim();
  const hasBody = !!(fields.body || '').trim();
  const { scenes, videoDuration } = buildScenes(audioDuration, { hasDate, hasTime, hasLocation, hasBody });

  // mesaj satırları: cümle/paragraf — tahmini zamanlama (satır sayısına göre)
  const rawLines = (fields.body || '')
    .split(/\n+|(?<=[.!?…])\s+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const msgScene = scenes.find((s) => s.type === 'message');
  const lines = [];
  if (msgScene && rawLines.length) {
    const per = msgScene.dur / rawLines.length;
    rawLines.forEach((text, i) => {
      lines.push({
        type: 'message',
        text,
        display: text,
        start: msgScene.start + i * per,
        end: msgScene.start + (i + 1) * per,
        words: [],
        approx: true,
      });
    });
  }
  return { scenes, phrases: lines, videoDuration, timing: 'approx' };
}

/** Belirli bir anda aktif olan sahne */
export function sceneAt(scenes, t) {
  return scenes.find((s) => t >= s.start && t < s.end) || null;
}

/** Belirli bir anda ekranda olması gereken mesaj satırları */
export function visiblePhrases(phrases, t, { lead = 0.3 } = {}) {
  return phrases
    .filter((p) => p.start <= t + lead)
    .map((p, i) => ({ ...p, progress: Math.min(1, Math.max(0, (t - p.start) / 0.35)) }));
}

export { wordsOf, estimateSeconds };
