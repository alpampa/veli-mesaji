/* Dışa aktarma: canlı önizlemeyi 1080×1920 MP4'e dönüştürür.
 *
 * Yol 1 (hızlı): canvas.captureStream + WebAudio → MediaRecorder.
 *   Chrome/Edge/Safari  → video/mp4 (H.264 + AAC) doğrudan.
 * Yol 2 (Firefox vb.):  webm kaydedilir → FFmpeg (WASM) ile MP4'e çevrilir.
 */

import { fmtClock } from './utils.js';
import { VIDEO_W, VIDEO_H } from './renderer.js';

export const MP4_MIMES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1.64001E,mp4a.40.2',
  'video/mp4',
];

export const WEBM_MIMES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of [...MP4_MIMES, ...WEBM_MIMES]) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch { /* yok say */ }
  }
  return null;
}

export function isMp4Mime(mime) {
  return !!mime && mime.startsWith('video/mp4');
}

const MAX_DURATION = 40; // saniye — hard limit

/**
 * Üretim öncesi doğrulama.
 * @returns {{ok:boolean, errors:string[], warnings:string[], blocking:string[]}}
 */
export function validateBeforeExport({ audio, sameCheck, fields }) {
  const errors = [];
  const warnings = [];
  const blocking = [];

  if (!audio) {
    errors.push('Önce bir ses ekleyin (Yapay Ses, Kayıt veya Dosya).');
    blocking.push('no-audio');
  } else if (audio.duration > MAX_DURATION + 0.5) {
    errors.push(`Ses ${fmtClock(audio.duration, true)} — 40 saniyelik sınırı aşıyor. Metni kısaltın veya daha kısa bir ses kullanın.`);
    blocking.push('too-long');
  }

  if (!sameCheck) {
    errors.push('Metin ve sesin aynı bilgiyi verdiğini onaylamadınız.');
    blocking.push('no-confirm');
  }

  const body = (fields.body || '').trim();
  const hasInfo =
    /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(body) ||
    /\d{1,2}[:.]\d{2}/.test(body) ||
    /\b(\+90|0\d{2,3})\s?\d{3}\s?\d{2}\s?\d{2}\b/.test(body) ||
    /\b(telefon|arayabilir|ulaşabilir|iletişim|whatsapp|numara)\b/i.test(body) ||
    /(yarın|pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar)/i.test(body);
  if (!hasInfo) {
    warnings.push('Mesajda tarih, saat veya iletişim bilgisi görünmüyor — veliler ulaşamayabilir.');
  }

  if (!body && !(fields.title || '').trim()) {
    warnings.push('Başlık ve mesaj boş görünüyor. Yine de üretmek isterseniz devam edebilirsiniz.');
  }

  return { ok: errors.length === 0, errors, warnings, blocking };
}

/**
 * Videonun MP4'ünü üretir.
 * @param {object} opts
 * @param {import('./renderer.js').StudioRenderer} opts.renderer
 * @param {AudioBuffer} opts.audioBuffer
 * @param {Array} opts.scenes
 * @param {number} opts.videoDuration
 * @param {(stage:string, data?:object)=>void} opts.onStage
 * @param {(progress:number)=>void} opts.onProgress 0..1
 * @returns {Promise<{blob:Blob, mime:string, transcoded:boolean}>}
 */
export async function exportVideo({ renderer, audioBuffer, videoDuration, onStage, onProgress }) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Tarayıcınız video kaydını desteklemiyor. Güncel Chrome veya Edge deneyin.');
  }
  const mime = pickRecorderMime();
  if (!mime) throw new Error('Tarayıcınız video kaydını desteklemiyor.');

  onStage('render');
  onProgress(0);

  const canvas = renderer.canvas;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') await ctx.resume();

  const canvasStream = canvas.captureStream(30);
  const sink = ctx.createMediaStreamDestination();
  const src = ctx.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(sink);

  const stream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...sink.stream.getAudioTracks(),
  ]);

  const rec = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 8_000_000,
    audioBitsPerSecond: 192_000,
  });
  const chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise((resolve, reject) => {
    rec.onerror = () => reject(new Error('Video kaydı sırasında hata oluştu.'));
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || mime });
      resolve(blob);
    };
  });

  rec.start(250);

  const audioStart = ctx.currentTime + 0.35;
  src.start(audioStart);
  const t0 = performance.now() + (audioStart - ctx.currentTime) * 1000;

  // render döngüsü: ses saati ana saat
  await new Promise((resolve) => {
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      renderer.renderFrame(t);
      onProgress(Math.min(1, t / videoDuration));
      if (t >= videoDuration + 0.5) {
        try { src.stop(); } catch { /* yok say */ }
        rec.stop();
        resolve();
      } else {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  });

  const blob = await done;
  try { await ctx.close(); } catch { /* yok say */ }

  if (isMp4Mime(blob.type)) {
    return { blob, mime: blob.type, transcoded: false };
  }

  // webm → MP4 (FFmpeg WASM)
  onStage('transcode');
  try {
    const mp4 = await transcodeWebmToMp4(blob, onProgress);
    return { blob: mp4, mime: 'video/mp4', transcoded: true };
  } catch (err) {
    return { blob, mime: blob.type, transcoded: false, transcodeError: err.message };
  }
}

/** FFmpeg WASM ile webm → H.264/AAC MP4 (tek iş parçacıklı çekirdek) */
async function transcodeWebmToMp4(webmBlob, onProgress) {
  const { FFmpeg } = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js');
  const CORE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: CORE + '/ffmpeg-core.js',
    wasmURL: CORE + '/ffmpeg-core.wasm',
  });
  ffmpeg.on('progress', ({ progress }) => onProgress && onProgress(progress));
  await ffmpeg.writeFile('input.webm', new Uint8Array(await webmBlob.arrayBuffer()));
  await ffmpeg.exec([
    '-progress', 'pipe:1',
    '-i', 'input.webm',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '160k',
    '-vf', `scale=${VIDEO_W}:${VIDEO_H}`,
    '-movflags', '+faststart',
    '-y', 'output.mp4',
  ]);
  const data = await ffmpeg.readFile('output.mp4');
  await ffmpeg.terminate();
  return new Blob([data.buffer], { type: 'video/mp4' });
}

export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 4000);
}

/** Web Share API ile paylaşım; dosya desteklenmiyorsa fallback mesajı döner */
export async function shareFile(blob, filename, title) {
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], filename)] })) {
    try {
      await navigator.share({
        files: [new File([blob], filename, { type: blob.type })],
        title,
      });
      return { method: 'native' };
    } catch (err) {
      if (err && err.name === 'AbortError') return { method: 'aborted' };
      // düş: fallback
    }
  }
  return { method: 'fallback' };
}

export function waShareUrl(text) {
  return 'https://wa.me/?text=' + encodeURIComponent(text);
}

export function mailtoUrl({ subject, body }) {
  return 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
}
