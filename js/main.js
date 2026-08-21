/* Veli Mesajı Studio — ana uygulama (V2)
 *
 * TTS üretimi sunucu tarafındadır (server/server.py). Bu dosya yalnızca
 * sunucuyu bulur, ses listesini çeker ve WAV'ı oynatır.
 */

import {
  $, $$, clamp, fmtClock, wordsOf, estimateSeconds,
  debounce, loadJSON, saveJSON, escapeHtml,
} from './utils.js';
import {
  VIDEO_TEMPLATES, TEMPLATE_ORDER, MESSAGE_TEMPLATES,
  DEFAULT_FIELDS, DEFAULT_SETTINGS, DEMO_FIELDS,
} from './templates.js';
import { AudioEngine } from './audio.js';
import { buildScenes, SCENE_LABEL } from './scenes.js';
import { StudioRenderer } from './renderer.js';
import {
  BackendTTSProvider, BrowserSpeechProvider, TTS_SAMPLE_TEXT, PROVIDER_META,
} from './tts.js';
import {
  validateBeforeExport, exportVideo, shareFile, waShareUrl, mailtoUrl,
} from './exporter.js';

const DRAFT_KEY = 'vms.v2.draft';
const SETTINGS_KEY = 'vms.v2.settings';
const MAX_SECONDS = 40;

/* ---------------- Durum ---------------- */

const state = {
  fields: { ...DEFAULT_FIELDS, school: '' },
  templateId: 'cinematic',
  audio: null, // { kind, name, blob, buffer, duration, peaks, url }
  sameCheck: false,
  settings: { ...DEFAULT_SETTINGS, ...loadJSON(SETTINGS_KEY, {}) },
};

const audioEngine = new AudioEngine();
const renderer = new StudioRenderer($('#stage'));
const tts = new BackendTTSProvider();
const speech = new BrowserSpeechProvider();

let previewTime = 0;
let playing = false;
let rafId = null;
let fallbackClock = null; // ses bitince manuel saat
let demoMode = false;
let demoClock = null;
let lastResultUrl = null;
let lastResultName = 'veli-mesaji.mp4';

/* ---------------- Elemanlar ---------------- */

const els = {
  school: $('#school'), title: $('#title'), date: $('#date'), time: $('#time'),
  location: $('#location'), body: $('#body'), sign: $('#sign'),
  msgEstimate: $('#msgEstimate'), msgTemplates: $('#msgTemplates'),
  clearBtn: $('#clearBtn'),
  templateGrid: $('#templateGrid'), readiness: $('#readiness'),
  stageEmpty: $('#stageEmpty'),
  playBtn: $('#playBtn'), icPlay: $('.t-ic-play'), icPause: $('.t-ic-pause'),
  tCur: $('#tCur'), tDur: $('#tDur'), tNote: $('#tNote'),
  timeline: $('#timeline'),
  voiceTabs: $$('.tab', $('#voiceTabs')), tabBodies: $$('.tab-body'),
  voiceGallery: $('#voiceGallery'), ttsSetup: $('#ttsSetup'), ttsStatus: $('#ttsStatus'),
  recBtn: $('#recBtn'), recStop: $('#recStop'), recLabel: $('#recLabel'),
  recFill: $('#recFill'), recTime: $('#recTime'), recHint: $('#recHint'), recErr: $('#recErr'),
  dropZone: $('#dropZone'), fileInput: $('#fileInput'),
  voiceSummary: $('#voiceSummary'), vsKind: $('#vsKind'), vsName: $('#vsName'),
  vsSub: $('#vsSub'), vsPlay: $('#vsPlay'), vsRemove: $('#vsRemove'),
  genChecks: $('#genChecks'), generateBtn: $('#generateBtn'),
  renderModal: $('#renderModal'), renderStages: $('#renderStages'),
  renderFill: $('#renderFill'), renderMeta: $('#renderMeta'),
  resultModal: $('#resultModal'), resultVideo: $('#resultVideo'),
  resultTime: $('#resultTime'), resultNote: $('#resultNote'),
  dlBtn: $('#dlBtn'), waBtn: $('#waBtn'), mailBtn: $('#mailBtn'), newBtn: $('#newBtn'),
  resultClose: $('#resultClose'),
  settingsModal: $('#settingsModal'), settingsClose: $('#settingsClose'),
  sSchool: $('#sSchool'), sPhone: $('#sPhone'), sAddress: $('#sAddress'),
  sLogoInput: $('#sLogoInput'), sLogoPreview: $('#sLogoPreview'), sLogoClear: $('#sLogoClear'),
  sTtsUrl: $('#sTtsUrl'), sTtsAuto: $('#sTtsAuto'), sTtsTest: $('#sTtsTest'), sTtsResult: $('#sTtsResult'),
  sSave: $('#sSave'), sReset: $('#sReset'),
  draftBtn: $('#draftBtn'), draftState: $('#draftState'), settingsBtn: $('#settingsBtn'),
  toast: $('#toast'),
};

/* ---------------- Yardımcılar ---------------- */

let toastTimer = null;
function toast(msg, ms = 3400) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), ms);
}

function currentDuration() {
  if (state.audio) return state.audio.duration;
  return estimateSeconds(wordsOf(state.fields.body));
}

function videoDuration() {
  return renderer.videoDuration || 1;
}

function fullText() {
  return [
    state.fields.title.trim(),
    state.fields.date.trim() + (state.fields.time.trim() ? ' ' + state.fields.time.trim() : ''),
    state.fields.location.trim(),
    state.fields.body.trim(),
    state.fields.sign.trim(),
  ].filter(Boolean).join('. ');
}

/* ---------------- Demo önizleme ---------------- */

function startDemo() {
  demoMode = true;
  els.stageEmpty.classList.add('hidden');
  renderer.setFields({ ...DEMO_FIELDS, school: state.fields.school || DEMO_FIELDS.school });
  const dur = estimateSeconds(wordsOf(DEMO_FIELDS.body));
  const { scenes, videoDuration: vd } = buildScenes(dur, {
    hasDate: true, hasTime: true, hasLocation: true, hasBody: true,
  });
  renderer.setScenes({ scenes, videoDuration: vd });
  previewTime = 0;
  els.tDur.textContent = fmtClock(vd);
  els.tNote.textContent = 'Demo sahne — kendi metninizi yazınca değişir';
  drawTimeline();
  updateTimeUI();
  play();
}

function exitDemo() {
  if (!demoMode) return;
  demoMode = false;
  pause();
  els.tNote.classList.remove('warn');
}

function loopDemo() {
  const t = demoClock.at + (performance.now() - demoClock.t0) / 1000;
  const vd = videoDuration();
  const wrapped = t % Math.max(0.5, vd);
  previewTime = wrapped;
  renderer.renderFrame(wrapped);
  drawTimelineThrottled();
  updateTimeUI();
  rafId = requestAnimationFrame(loopDemo);
}

/* ---------------- Form eşitleme ---------------- */

function syncFields() {
  exitDemo();
  state.fields = {
    school: els.school.value,
    title: els.title.value,
    date: els.date.value,
    time: els.time.value,
    location: els.location.value,
    body: els.body.value,
    sign: els.sign.value,
  };
  const w = wordsOf(els.body.value);
  els.msgEstimate.textContent = w ? `${w} kelime ≈ ${estimateSeconds(w)} sn` : '';
  renderer.setFields(state.fields);
  refreshScenes();
  updateEmptyState();
  scheduleDraftSave();
}

function applyFields(f) {
  els.school.value = f.school || '';
  els.title.value = f.title || '';
  els.date.value = f.date || '';
  els.time.value = f.time || '';
  els.location.value = f.location || '';
  els.body.value = f.body || '';
  els.sign.value = f.sign || '';
  syncFields();
}

/* ---------------- Sahne kurulumu ---------------- */

function refreshScenes() {
  const { scenes, videoDuration: vd } = buildScenes(currentDuration(), {
    hasDate: !!state.fields.date.trim(),
    hasTime: !!state.fields.time.trim(),
    hasLocation: !!state.fields.location.trim(),
    hasBody: !!state.fields.body.trim(),
  });
  renderer.setScenes({ scenes, videoDuration: vd });
  previewTime = clamp(previewTime, 0, vd);
  els.tDur.textContent = fmtClock(vd);
  updateTNote();
  renderCurrent();
  drawTimeline();
}

function updateTNote() {
  if (state.audio) {
    const d = state.audio.duration;
    els.tNote.textContent = d > MAX_SECONDS + 0.5
      ? `⚠ Ses ${fmtClock(d, true)} — 40 sn sınırı aşıldı, üretim engelli`
      : `Ses ${fmtClock(d, true)} · sahnelere göre dağıtıldı`;
    els.tNote.classList.toggle('warn', d > MAX_SECONDS + 0.5);
  } else {
    const w = wordsOf(state.fields.body);
    els.tNote.textContent = w
      ? `Ses yok — tahmini süre ${estimateSeconds(w)} sn`
      : 'Ses ekleyince gerçek süre görünür';
    els.tNote.classList.remove('warn');
  }
}

function renderCurrent() {
  if (renderer.ok) renderer.renderFrame(previewTime);
}

/* ---------------- Önizleme oynatma ---------------- */

function setPlayingUI(on) {
  els.playBtn.classList.toggle('playing', on);
  els.icPlay.style.display = on ? 'none' : '';
  els.icPause.style.display = on ? '' : 'none';
}

function play() {
  if (!renderer.ok) return;
  const hasAny = Object.values(state.fields).some((v) => v.trim());
  if (!hasAny && !state.audio && !demoMode) return;
  playing = true;
  setPlayingUI(true);
  fallbackClock = null;
  if (demoMode) {
    demoClock = { at: previewTime, t0: performance.now() };
    rafId = requestAnimationFrame(loopDemo);
    return;
  }
  if (state.audio) {
    audioEngine.play({
      offset: previewTime,
      onEnd: () => {
        fallbackClock = { at: audioEngine.duration, t0: performance.now() };
      },
    });
    rafId = requestAnimationFrame(loopAudio);
  } else {
    fallbackClock = { at: previewTime, t0: performance.now() };
    rafId = requestAnimationFrame(loopSilent);
  }
}

function currentPlayTime() {
  if (state.audio && audioEngine.playing) return audioEngine.currentTime;
  if (fallbackClock) return fallbackClock.at + (performance.now() - fallbackClock.t0) / 1000;
  return previewTime;
}

function loopAudio() {
  const t = currentPlayTime();
  previewTime = t;
  renderer.renderFrame(t);
  drawTimelineThrottled();
  if (t >= videoDuration() + 0.05) return pauseAtEnd();
  rafId = requestAnimationFrame(loopAudio);
}

function loopSilent() {
  return loopAudio();
}

function pause() {
  playing = false;
  setPlayingUI(false);
  cancelAnimationFrame(rafId);
  audioEngine.pause();
}

function pauseAtEnd() {
  pause();
  previewTime = videoDuration();
  renderer.renderFrame(previewTime);
  drawTimeline();
  updateTimeUI();
}

function togglePlay() {
  if (playing) pause();
  else play();
}

function seek(t) {
  t = clamp(t, 0, videoDuration());
  previewTime = t;
  if (playing) {
    if (demoMode) {
      demoClock = { at: t, t0: performance.now() };
    } else if (state.audio) {
      audioEngine.play({
        offset: t,
        onEnd: () => { fallbackClock = { at: audioEngine.duration, t0: performance.now() }; },
      });
    } else {
      fallbackClock = { at: t, t0: performance.now() };
    }
  }
  renderer.renderFrame(t);
  drawTimeline();
  updateTimeUI();
}

function updateTimeUI() {
  els.tCur.textContent = fmtClock(previewTime);
}

els.playBtn.addEventListener('click', togglePlay);
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement?.tagName)) {
    e.preventDefault();
    togglePlay();
  }
});

/* ---------------- Timeline ---------------- */

let tlHover = -1;
let tlDrawQueued = false;

function measureTimeline() {
  const wrap = $('.timeline-wrap');
  const w = Math.max(200, wrap.clientWidth);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  els.timeline.width = Math.round(w * dpr);
  els.timeline.height = Math.round(96 * dpr);
  els.timeline.style.height = '96px';
}

function timelineCtx() {
  const ctx = els.timeline.getContext('2d');
  if (!ctx) return null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

const C = {
  ink: '#191612', muted: '#8A8175', faint: '#C9C1B4',
  track: '#EFEBE4', primary: '#C9452C', ok: '#0E7C6B',
};

function drawTimeline() {
  const ctx = timelineCtx();
  if (!ctx) return;
  const W = els.timeline.width / Math.min(2, window.devicePixelRatio || 1);
  const H = 96;
  const vd = videoDuration();
  const xOf = (t) => (t / Math.max(0.1, vd)) * W;

  ctx.clearRect(0, 0, W, H);

  // dalga formu
  if (state.audio && state.audio.peaks) {
    const peaks = state.audio.peaks;
    const n = Math.min(peaks.length, Math.max(60, Math.floor(W / 2)));
    const step = peaks.length / n;
    const cy = 74;
    const barW = (W / n) * 0.72;
    for (let i = 0; i < n; i++) {
      const pk = peaks[Math.floor(i * step)] || 0;
      const h = Math.max(1.5, pk * 34);
      ctx.fillStyle = C.faint;
      const x = (i / n) * W + (W / n - barW) / 2;
      ctx.fillRect(x, cy - h / 2, barW, h);
    }
  }

  // sahne bölümleri
  renderer.scenes.forEach((s, i) => {
    const x = xOf(s.start);
    const w = Math.max(2, xOf(s.end) - x - 2);
    const active = previewTime >= s.start && previewTime < s.end;
    const hover = tlHover === i;
    ctx.fillStyle = active ? C.primary : hover ? C.ink : C.track;
    roundRect(ctx, x, 30, w, 24, 6);
    ctx.fill();
    // üst etiket
    if (w > 30) {
      ctx.font = '600 9px Inter, sans-serif';
      ctx.fillStyle = active ? C.primary : C.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(SCENE_LABEL[s.type] || s.type.toUpperCase(), x + w / 2, 22);
    }
    if (w > 46) {
      ctx.font = '600 10.5px Inter, sans-serif';
      ctx.fillStyle = active ? '#fff' : C.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(SCENE_LABEL[s.type] || s.type.toUpperCase(), x + w / 2, 42);
    }
  });

  // zaman cetveli
  ctx.fillStyle = C.muted;
  ctx.font = '500 9.5px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (let t = 0; t <= vd + 0.01; t += 5) {
    const x = xOf(t);
    ctx.fillRect(x, 88, 1, 8);
    ctx.fillText(fmtClock(t), x + 3, 92);
  }
  ctx.fillText(fmtClock(vd), W - 30, 92);

  // oynatma kafası
  const px = xOf(clamp(previewTime, 0, vd));
  ctx.strokeStyle = C.primary;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, 2);
  ctx.lineTo(px, 88);
  ctx.stroke();
  ctx.fillStyle = C.primary;
  ctx.beginPath();
  ctx.moveTo(px - 5, 4);
  ctx.lineTo(px + 5, 4);
  ctx.lineTo(px, 11);
  ctx.closePath();
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTimelineThrottled() {
  if (tlDrawQueued) return;
  tlDrawQueued = true;
  requestAnimationFrame(() => {
    tlDrawQueued = false;
    drawTimeline();
  });
}

els.timeline.addEventListener('click', (e) => {
  const rect = els.timeline.getBoundingClientRect();
  const vd = videoDuration();
  const t = ((e.clientX - rect.left) / rect.width) * vd;
  seek(clamp(t, 0, vd));
});

els.timeline.addEventListener('mousemove', (e) => {
  const rect = els.timeline.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const vd = videoDuration();
  let idx = -1;
  renderer.scenes.forEach((s, i) => {
    const sx = (s.start / vd) * rect.width;
    const sw = ((s.end - s.start) / vd) * rect.width;
    if (x >= sx && x <= sx + sw) idx = i;
  });
  if (idx !== tlHover) {
    tlHover = idx;
    els.timeline.style.cursor = idx >= 0 ? 'pointer' : 'default';
    drawTimeline();
  }
});

els.timeline.addEventListener('mouseleave', () => {
  if (tlHover !== -1) { tlHover = -1; drawTimeline(); }
});

window.addEventListener('resize', debounce(() => {
  measureTimeline();
  drawTimeline();
}, 150));

/* ---------------- Ses: kayıt ---------------- */

let recorder = null;
let recChunks = [];
let recStream = null;
let recTimerId = null;
let recSeconds = 0;

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  const list = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
  return list.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}
function extFor(mime) {
  if (!mime) return 'webm';
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

function recTick() {
  els.recTime.textContent = fmtClock(recSeconds, false);
  const pct = Math.min(100, (recSeconds / MAX_SECONDS) * 100);
  els.recFill.style.width = `${pct}%`;
  els.recFill.classList.toggle('warn', recSeconds > MAX_SECONDS);
  els.recFill.classList.toggle('bad', recSeconds > 60);
  els.recHint.classList.remove('ok', 'warn', 'bad');
  if (recSeconds <= MAX_SECONDS) {
    els.recHint.textContent = 'Hedef: 40 sn altı';
    els.recHint.classList.add('ok');
  } else if (recSeconds <= 60) {
    els.recHint.textContent = '40 sn doldu — kısaltın';
    els.recHint.classList.add('warn');
  } else {
    els.recHint.textContent = 'Çok uzun — kısa tutun';
    els.recHint.classList.add('bad');
  }
}

async function startRecording() {
  if (recorder) return;
  if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
    showRecErr('Tarayıcınız mikrofon kaydını desteklemiyor. Güncel Chrome/Edge kullanın veya ses dosyası yükleyin.');
    return;
  }
  try {
    recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showRecErr('Mikrofona erişilemedi. İzin verdiğinizden emin olun ya da ses dosyası yükleyin.');
    return;
  }
  const mime = pickMime();
  recChunks = [];
  try {
    recorder = mime ? new MediaRecorder(recStream, { mimeType: mime }) : new MediaRecorder(recStream);
  } catch {
    showRecErr('Kayıt başlatılamadı. Ses dosyası yüklemeyi deneyin.');
    stopStream();
    return;
  }
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) recChunks.push(e.data); };
  recorder.onstop = onRecordingStop;
  recorder.start();
  recSeconds = 0;
  els.recLabel.textContent = 'Kaydediliyor…';
  els.recBtn.classList.add('recording');
  els.recStop.classList.remove('hidden');
  els.recErr.classList.add('hidden');
  recTimerId = setInterval(() => {
    recSeconds += 1;
    recTick();
    if (recSeconds >= 120) stopRecording();
  }, 1000);
}

function stopRecording() {
  if (!recorder) return;
  clearInterval(recTimerId);
  try { recorder.stop(); } catch { /* yok say */ }
}

function onRecordingStop() {
  const rec = recorder;
  recorder = null;
  stopStream();
  els.recBtn.classList.remove('recording');
  els.recStop.classList.add('hidden');
  els.recLabel.textContent = 'Kayıt başlat';
  const blob = new Blob(recChunks, { type: rec.mimeType || 'audio/webm' });
  recChunks = [];
  if (blob.size === 0) {
    showRecErr('Kayıt boş görünüyor. Mikrofonu kontrol edip tekrar deneyin.');
    return;
  }
  const ext = extFor(rec.mimeType || '');
  setAudio({ kind: 'record', name: `Mikrofon kaydı.${ext}`, blob })
    .then(() => toast(`Kayıt hazır: ${fmtClock(state.audio.duration, true)}`));
}

function stopStream() {
  if (recStream) {
    recStream.getTracks().forEach((t) => t.stop());
    recStream = null;
  }
}

function showRecErr(msg) {
  els.recErr.textContent = msg;
  els.recErr.classList.remove('hidden');
}

els.recBtn.addEventListener('click', startRecording);
els.recStop.addEventListener('click', stopRecording);

/* ---------------- Ses: dosya ---------------- */

els.dropZone.addEventListener('click', () => els.fileInput.click());
els.dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileInput.click(); }
});
['dragover', 'dragenter'].forEach((ev) =>
  els.dropZone.addEventListener(ev, (e) => { e.preventDefault(); els.dropZone.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) =>
  els.dropZone.addEventListener(ev, (e) => { e.preventDefault(); els.dropZone.classList.remove('over'); }));
els.dropZone.addEventListener('drop', (e) => {
  const f = e.dataTransfer?.files?.[0];
  if (f) handleFile(f);
});
els.fileInput.addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (f) handleFile(f);
});

function handleFile(file) {
  if (file.size > 25 * 1024 * 1024) {
    toast('Dosya 25 MB\'dan büyük. Daha kısa bir kayıt kullanın.');
    return;
  }
  setAudio({ kind: 'file', name: file.name, blob: file })
    .then(() => toast(`Ses yüklendi: ${fmtClock(state.audio.duration, true)}`));
}

/* ---------------- Ses: ortak ---------------- */

async function setAudio({ kind, name, blob }) {
  exitDemo();
  stopPlayback();
  let buffer;
  try {
    buffer = await audioEngine.setBufferFromBlob(blob);
  } catch {
    toast('Bu ses dosyası okunamadı. MP3, WAV, M4A veya OGG deneyin.');
    return;
  }
  if (state.audio) URL.revokeObjectURL(state.audio.url);
  const url = URL.createObjectURL(blob);
  const peaks = await audioEngine.decodePeaks(720);
  state.audio = { kind, name, blob, buffer, duration: buffer.duration, peaks, url };
  previewTime = 0;
  refreshScenes();
  updateVoiceSummary();
  updateReadiness();
  updateGenChecks();
  updateEmptyState();
}

function stopPlayback() {
  playing = false;
  setPlayingUI(false);
  cancelAnimationFrame(rafId);
  audioEngine.stop();
  fallbackClock = null;
}

function clearAudio() {
  exitDemo();
  stopPlayback();
  if (state.audio) URL.revokeObjectURL(state.audio.url);
  state.audio = null;
  previewTime = 0;
  els.voiceSummary.classList.add('hidden');
  refreshScenes();
  updateReadiness();
  updateGenChecks();
  updateEmptyState();
}

const KIND_LABEL = { ai: 'Yapay ses', record: 'Kayıt', file: 'Dosya' };
const KIND_ICON = { ai: '✨', record: '🎙', file: '📁' };

function updateVoiceSummary() {
  const a = state.audio;
  if (!a) { els.voiceSummary.classList.add('hidden'); return; }
  els.voiceSummary.classList.remove('hidden');
  els.vsKind.textContent = KIND_ICON[a.kind] || '🎙';
  els.vsName.textContent = a.name;
  els.vsSub.textContent = `${fmtClock(a.duration, true)} · ${KIND_LABEL[a.kind] || ''}${a.duration > MAX_SECONDS ? ' · ⚠ 40 sn aşımı' : ''}`;
  els.vsSub.classList.toggle('warn', a.duration > MAX_SECONDS);
}

els.vsPlay.addEventListener('click', () => {
  seek(0);
  if (!playing) play();
});
els.vsRemove.addEventListener('click', clearAudio);

/* ---------------- Yapay ses: seslendirme stüdyosu ---------------- */

function setTtsStatus(type, html) {
  els.ttsStatus.className = 'tts-status' + (type ? ' ' + type : '');
  els.ttsStatus.innerHTML = html || '';
}

async function refreshVoiceStudio() {
  els.voiceGallery.classList.add('hidden');
  els.ttsSetup.classList.add('hidden');
  setTtsStatus('busy', '<div class="busy-row"><span class="spinner"></span><div>TTS sunucusu aranıyor…</div></div>');
  try {
    const ok = await tts.discover({
      ttsUrl: state.settings.ttsUrl,
      ttsAuto: state.settings.ttsAuto,
    });
    if (!ok) {
      setTtsStatus('');
      renderTtsSetup();
      return;
    }
    setTtsStatus('');
    renderVoiceGallery(tts.lastVoices);
  } catch (err) {
    console.error('TTS keşif hatası:', err);
    setTtsStatus('');
    renderTtsSetup();
  }
}

function renderTtsSetup() {
  els.voiceGallery.classList.add('hidden');
  els.ttsSetup.classList.remove('hidden');
  els.ttsSetup.innerHTML = `
    <div class="setup-ic">🎙</div>
    <h4>Yapay sesler kullanılamıyor</h4>
    <p>TTS üretimi tarayıcıda değil, <b>yerel TTS sunucusunda</b> yapılır (gizlilik + çevrimdışı Piper desteği).</p>
    <ol class="setup-steps">
      <li><code>pip install -r server/requirements.txt</code></li>
      <li><code>python server/server.py</code></li>
      <li>Sayfayı yenileyin — <b>http://127.0.0.1:8765</b> otomatik bulunur</li>
    </ol>
    <p class="setup-note">GitHub Pages'ten kullanıyorsanız sunucuyu Ayarlar → TTS sunucusu bölümünden bağlayın.</p>
    <div class="vc-actions">
      <button type="button" class="btn btn-sm ghost" id="ttsRetry">↻ Yeniden Dene</button>
      <button type="button" class="btn btn-sm ghost" id="ttsBrowserSample">🔊 Örnek (cihaz sesi)</button>
    </div>
    <p class="setup-note">Sunucu olmadan da <b>Ses Kaydı</b> ve <b>Ses Dosyası</b> sekmeleriyle video üretebilirsiniz.</p>`;
  $('#ttsRetry').addEventListener('click', refreshVoiceStudio);
  $('#ttsBrowserSample').addEventListener('click', () => {
    if (speech.speak(TTS_SAMPLE_TEXT, { onEnd: () => setTtsStatus('') })) {
      setTtsStatus('sample', '🔊 Örnek cihaz sesiyle okunuyor (yalnızca önizleme — videoya yazılmaz)');
    } else {
      toast('Bu cihazda sesli okuma desteklenmiyor.');
    }
  });
}

function renderVoiceGallery(voices) {
  els.voiceGallery.classList.remove('hidden');
  els.voiceGallery.innerHTML = '';
  if (!voices.length) {
    els.voiceGallery.innerHTML = '<p class="hint">Sunucuya bağlandı ama kullanılabilir Türkçe ses bulunamadı. Piper modeli için <code>models/piper/tr/</code> klasörüne .onnx ekleyin.</p>';
    return;
  }
  const groups = {};
  voices.forEach((v) => {
    (groups[v.provider] = groups[v.provider] || []).push(v);
  });
  for (const [provider, list] of Object.entries(groups)) {
    const meta = PROVIDER_META[provider] || { badge: provider, note: '', cls: '' };
    const g = document.createElement('div');
    g.className = 'vc-group';
    g.innerHTML = `<div class="vc-group-head"><span class="vc-badge ${meta.cls}">${escapeHtml(meta.badge)}</span><span class="vc-group-note">${escapeHtml(meta.note || '')}</span></div>`;
    const cards = document.createElement('div');
    cards.className = 'voice-cards';
    list.forEach((v) => cards.append(makeVoiceCard(v)));
    g.append(cards);
    els.voiceGallery.append(g);
  }
}

function makeVoiceCard(v) {
  const card = document.createElement('div');
  card.className = 'voice-card';
  const meta = PROVIDER_META[v.provider] || {};
  card.innerHTML = `
    <div class="vc-top">
      <span class="vc-avatar">${v.gender === 'Kadın' ? '♀' : '♂'}</span>
      <div class="vc-meta">
        <div class="vc-name">${escapeHtml(v.name)}</div>
        <div class="vc-tag">${escapeHtml(v.gender || '')} · ${escapeHtml(v.lang || 'Türkçe')}</div>
      </div>
      ${meta.badge ? `<span class="vc-badge sm ${meta.cls || ''}">${escapeHtml(meta.badge)}</span>` : ''}
    </div>
    <p class="vc-desc">${escapeHtml(v.style || '')}</p>
    <div class="vc-actions">
      <button type="button" class="btn btn-sm ghost" data-act="sample">▶ Örnek Dinle</button>
      <button type="button" class="btn btn-sm" data-act="generate">Bu Sesle Oluştur</button>
    </div>`;
  card.querySelector('[data-act="sample"]').addEventListener('click', () => sampleVoice(v, card));
  card.querySelector('[data-act="generate"]').addEventListener('click', () => generateVoice(v, card));
  return card;
}

function setVoiceBusy(card, busy) {
  card.querySelectorAll('button').forEach((b) => { b.disabled = busy; });
  card.classList.toggle('busy', busy);
}

/** Gerçek sesle örnek üretir (sunucu) ve çalar */
async function sampleVoice(v, card) {
  setVoiceBusy(card, true);
  setTtsStatus('busy', `<div class="busy-row"><span class="spinner"></span><div>${escapeHtml(v.name)} örneği hazırlanıyor…</div></div>`);
  try {
    const res = await tts.generate(TTS_SAMPLE_TEXT, v.id);
    const url = URL.createObjectURL(res.blob);
    const a = new Audio(url);
    a.onended = () => {
      URL.revokeObjectURL(url);
      setTtsStatus('');
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      setTtsStatus('error', 'Örnek çalınamadı.');
    };
    setTtsStatus('sample', `🔊 ${escapeHtml(v.name)} örneği çalıyor…`);
    await a.play();
  } catch (err) {
    console.error('Örnek üretim hatası:', err);
    setTtsStatus('error', `Örnek üretilemedi: ${escapeHtml(err.message || 'bilinmeyen hata')}`);
  } finally {
    setVoiceBusy(card, false);
  }
}

async function generateVoice(v, card) {
  const text = fullText();
  if (!text) {
    toast('Önce sol panelden duyuru metnini yazın.');
    return;
  }
  if (wordsOf(text) > 140) {
    toast('Metin çok uzun — 40 saniyenin altında kalması için kısaltın.');
    return;
  }
  setVoiceBusy(card, true);
  setTtsStatus('busy', `<div class="busy-row"><span class="spinner"></span><div>${escapeHtml(v.name)} seslendiriyor…</div></div>`);
  try {
    const res = await tts.generate(text, v.id);
    await setAudio({ kind: 'ai', name: `${v.name} sesi`, blob: res.blob });
    setTtsStatus('ok', `✓ ${escapeHtml(v.name)} ile seslendirildi — ${fmtClock(state.audio.duration, true)}`);
    toast(`Ses oluşturuldu: ${v.name}`);
  } catch (err) {
    console.error('TTS üretim hatası:', err, '| voice:', v.id, '| provider:', v.provider);
    setTtsStatus('error',
      `Seslendirme oluşturulamadı.<br><span class="err-detail">${escapeHtml(err.message || 'bilinmeyen hata')}</span><br>` +
      'Başka bir ses seçin veya <b>Kayıt</b> / <b>Dosya</b> sekmelerini kullanın.');
  } finally {
    setVoiceBusy(card, false);
  }
}

/* ---------------- Sekmeler ---------------- */

els.voiceTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    els.voiceTabs.forEach((t) => t.classList.toggle('active', t === tab));
    els.tabBodies.forEach((b) => {
      b.classList.toggle('hidden', b.dataset.tabbody !== tab.dataset.tab);
    });
    if (tab.dataset.tab === 'ai') refreshVoiceStudio();
  });
});

/* ---------------- Şablonlar ---------------- */

function renderMsgTemplates() {
  els.msgTemplates.innerHTML = '';
  MESSAGE_TEMPLATES.forEach((tpl) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip-chip';
    b.innerHTML = `${escapeHtml(tpl.icon)} ${escapeHtml(tpl.label)}`;
    b.title = 'Bu şablonu doldurur';
    b.addEventListener('click', () => {
      applyFields({ ...tpl.fields, school: state.fields.school });
      toast(`${tpl.label} şablonu dolduruldu`);
    });
    els.msgTemplates.append(b);
  });
}

function renderTemplateGrid() {
  els.templateGrid.innerHTML = '';
  TEMPLATE_ORDER.forEach((id) => {
    const t = VIDEO_TEMPLATES[id];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tmpl-card' + (id === state.templateId ? ' active' : '');
    b.dataset.id = id;
    b.innerHTML = `
      <span class="tmpl-swatch">
        <span class="ts-a" style="background:${t.swatch[0]}"></span>
        <span class="ts-b" style="background:${t.swatch[1]}"></span>
        <span class="ts-c" style="background:${t.swatch[2]}"></span>
      </span>
      <span class="tmpl-name">${escapeHtml(t.label)}</span>
      <span class="tmpl-desc">${escapeHtml(t.desc)}</span>`;
    b.addEventListener('click', () => {
      state.templateId = id;
      renderer.setTemplate(VIDEO_TEMPLATES[id]);
      els.templateGrid.querySelectorAll('.tmpl-card').forEach((x) => x.classList.toggle('active', x === b));
      renderCurrent();
      scheduleDraftSave();
    });
    els.templateGrid.append(b);
  });
}

/* ---------------- Hazırlık kontrolü ---------------- */

function contactInfoPresent() {
  const body = state.fields.body;
  return (
    /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(body) ||
    /\d{1,2}[:.]\d{2}/.test(body) ||
    /\b(\+90|0\d{2,3})\s?\d{3}\s?\d{2}\s?\d{2}\b/.test(body) ||
    /\b(telefon|arayabilir|ulaşabilir|iletişim|whatsapp|numara)\b/i.test(body) ||
    /(yarın|pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar)/i.test(body)
  );
}

function updateReadiness() {
  const items = [];
  const a = state.audio;

  if (a) {
    items.push({
      cls: a.duration <= MAX_SECONDS + 0.5 ? 'ok' : 'bad',
      mark: a.duration <= MAX_SECONDS + 0.5 ? '✓' : '✕',
      text: a.duration <= MAX_SECONDS + 0.5
        ? `Ses eklendi ve 40 sn altında (${fmtClock(a.duration, true)})`
        : `Ses ${fmtClock(a.duration, true)} — 40 sn sınırı aşıldı, üretim engelli`,
    });
  } else {
    items.push({
      cls: 'warn',
      mark: '…',
      text: 'Ses eklenmedi — üretim için Yapay Ses, Kayıt veya Dosya gerekli',
    });
  }

  items.push({
    cls: state.sameCheck ? 'ok' : 'warn',
    mark: state.sameCheck ? '✓' : '…',
    text: 'Metin ve ses aynı bilgiyi veriyor',
    checkbox: !state.sameCheck,
  });

  items.push({
    cls: contactInfoPresent() ? 'ok' : 'warn',
    mark: contactInfoPresent() ? '✓' : '!',
    text: contactInfoPresent()
      ? 'Tarih, saat veya iletişim bilgisi var'
      : 'Tarih / saat / iletişim bilgisi görünmüyor — veliler ulaşamayabilir',
  });

  els.readiness.innerHTML = '';
  items.forEach((it) => {
    const li = document.createElement('li');
    li.className = 'ri ' + it.cls;
    li.innerHTML = `<span class="ri-mark">${it.mark}</span>`;
    if (it.checkbox) {
      const label = document.createElement('label');
      label.className = 'ri-check';
      label.innerHTML = '<input type="checkbox" id="sameCheck"> ' + escapeHtml(it.text);
      li.append(label);
    } else {
      const span = document.createElement('span');
      span.className = 'ri-text';
      span.textContent = it.text;
      li.append(span);
    }
    els.readiness.append(li);
  });

  const cb = $('#sameCheck');
  if (cb) {
    cb.checked = state.sameCheck;
    cb.addEventListener('change', () => {
      state.sameCheck = cb.checked;
      updateReadiness();
      updateGenChecks();
      scheduleDraftSave();
    });
  }
}

function updateGenChecks() {
  const a = state.audio;
  const chips = [];
  if (a) {
    chips.push(a.duration <= MAX_SECONDS + 0.5
      ? `<span class="gc ok">✓ Ses ${fmtClock(a.duration, true)}</span>`
      : `<span class="gc bad">✕ Ses ${fmtClock(a.duration, true)} — 40 sn aşıldı</span>`);
  } else {
    chips.push('<span class="gc bad">✕ Ses yok</span>');
  }
  chips.push(state.sameCheck
    ? '<span class="gc ok">✓ Metin ↔ ses onaylı</span>'
    : '<span class="gc warn">… Metin ↔ ses onayı gerekli</span>');
  chips.push(contactInfoPresent()
    ? '<span class="gc ok">✓ İletişim bilgisi</span>'
    : '<span class="gc warn">! İletişim bilgisi yok</span>');

  els.genChecks.innerHTML = chips.join('');

  const ready = !!(a && a.duration <= MAX_SECONDS + 0.5 && state.sameCheck);
  els.generateBtn.disabled = !ready;
  els.generateBtn.title = ready
    ? 'Videoyu üret'
    : 'Üretim için: ses ekleyin (≤40 sn) ve "metin ↔ ses" onayını işaretleyin';
}

/* ---------------- Üretim ---------------- */

const RENDER_STAGES = [
  'Metin kontrol edildi',
  'Ses oluşturuldu',
  'Ses süresi doğrulandı',
  'Sahneler hazırlandı',
  'Video render ediliyor',
];

function openRenderModal() {
  els.renderStages.innerHTML = '';
  RENDER_STAGES.forEach((label, i) => {
    const li = document.createElement('li');
    li.dataset.stage = i;
    li.innerHTML = `<span class="st-mark"></span><span class="st-text">${escapeHtml(label)}</span>`;
    els.renderStages.append(li);
  });
  els.renderFill.style.width = '0%';
  els.renderMeta.textContent = '';
  els.renderModal.classList.remove('hidden');
}

function setStage(i, status) {
  const li = els.renderStages.querySelector(`[data-stage="${i}"]`);
  if (!li) return;
  li.classList.remove('done', 'active');
  if (status === 'done') li.classList.add('done');
  if (status === 'active') li.classList.add('active');
}

async function generate() {
  const v = validateBeforeExport({ audio: state.audio, sameCheck: state.sameCheck, fields: state.fields });
  if (!v.ok) {
    toast(v.errors[0], 5000);
    return;
  }

  openRenderModal();
  setStage(0, 'done');
  await new Promise((r) => setTimeout(r, 250));
  setStage(1, 'done');
  await new Promise((r) => setTimeout(r, 250));
  setStage(2, 'done');
  await new Promise((r) => setTimeout(r, 250));
  setStage(3, 'done');
  setStage(4, 'active');

  try {
    const result = await exportVideo({
      renderer,
      audioBuffer: state.audio.buffer,
      videoDuration: videoDuration(),
      onStage: (st) => {
        if (st === 'transcode') {
          const text = els.renderStages.querySelector('[data-stage="4"] .st-text');
          if (text) text.textContent = 'MP4\'e dönüştürülüyor (FFmpeg)…';
        }
      },
      onProgress: (p) => {
        els.renderFill.style.width = `${Math.round(p * 100)}%`;
        els.renderMeta.textContent = `%${Math.round(p * 100)}`;
      },
    });
    setStage(4, 'done');
    await new Promise((r) => setTimeout(r, 400));
    els.renderModal.classList.add('hidden');
    showResult(result);
  } catch (err) {
    console.error('Render hatası:', err);
    els.renderMeta.textContent = 'Hata: ' + err.message;
    toast('Video üretilemedi: ' + err.message, 6000);
    setTimeout(() => els.renderModal.classList.add('hidden'), 2600);
  }
}

/* ---------------- Sonuç ---------------- */

function showResult({ blob, transcoded, transcodeError }) {
  if (lastResultUrl) URL.revokeObjectURL(lastResultUrl);
  lastResultUrl = URL.createObjectURL(blob);
  const ext = blob.type && blob.type.includes('mp4') ? 'mp4' : 'webm';
  lastResultName = `veli-mesaji-${new Date().toISOString().slice(0, 10)}.${ext}`;
  els.resultVideo.src = lastResultUrl;
  els.resultVideo.load();

  const sec = state.audio ? state.audio.duration : videoDuration();
  els.resultTime.textContent = `${fmtClock(sec, true)} · ${(blob.size / 1e6).toFixed(1)} MB · MP4 (H.264 + AAC)`;

  let note = 'İndirip WhatsApp, Telegram veya e-postayla velilerinize gönderin.';
  if (transcodeError) {
    note = `Tarayıcınız MP4 üretemedi; WebM olarak kaydedildi (${transcodeError}). Android cihazlarda oynar; iPhone için MP4 dönüştürücü gerekebilir.`;
  } else if (transcoded) {
    note = 'Firefox üzerinde FFmpeg ile MP4\'e dönüştürüldü.';
  }
  els.resultNote.textContent = note;

  els.resultModal.classList.remove('hidden');
}

const filename = () => lastResultName;

els.dlBtn.addEventListener('click', () => {
  if (lastResultUrl) {
    const a = document.createElement('a');
    a.href = lastResultUrl;
    a.download = filename();
    document.body.append(a);
    a.click();
    a.remove();
    toast('İndirme başladı');
  }
});

els.waBtn.addEventListener('click', async () => {
  const blob = await (await fetch(lastResultUrl)).blob();
  const res = await shareFile(blob, filename(), 'Veli Duyurusu');
  if (res.method === 'native') return;
  const text = `Merhaba! Veli duyurumuzun videosu hazır. İndirip WhatsApp'tan gönderebilirsiniz:\n${location.href}`;
  window.open(waShareUrl(text), '_blank', 'noopener');
});

els.mailBtn.addEventListener('click', () => {
  const subject = state.fields.title || 'Veli Duyurusu';
  const body = `Merhaba,\n\nVeli duyurumuzun videosu ekteki MP4 dosyasıdır.\n${location.href}\n\n${state.fields.school || ''}`;
  window.location.href = mailtoUrl({ subject, body });
});

els.newBtn.addEventListener('click', () => {
  els.resultModal.classList.add('hidden');
  els.resultVideo.pause();
  clearAudio();
  state.sameCheck = false;
  applyFields({ school: '', title: '', date: '', time: '', location: '', body: '', sign: '' });
  toast('Yeni duyuru için alanlar temizlendi');
});

els.resultClose.addEventListener('click', () => {
  els.resultModal.classList.add('hidden');
  els.resultVideo.pause();
});

/* ---------------- Temizle ---------------- */

els.clearBtn.addEventListener('click', () => {
  if (!confirm('Tüm metni ve sesi temizleyeyim mi?')) return;
  clearAudio();
  state.sameCheck = false;
  applyFields({ school: '', title: '', date: '', time: '', location: '', body: '', sign: '' });
  toast('Temizlendi');
});

/* ---------------- Ayarlar ---------------- */

function applySettingsToRenderer() {
  if (state.settings.schoolLogoUrl) {
    const img = new Image();
    img.onload = () => renderer.setLogo(img);
    img.src = state.settings.schoolLogoUrl;
  } else {
    renderer.setLogo(null);
  }
}

function openSettings() {
  els.sSchool.value = state.settings.schoolName;
  els.sPhone.value = state.settings.schoolPhone;
  els.sAddress.value = state.settings.schoolAddress;
  els.sTtsUrl.value = state.settings.ttsUrl || '';
  els.sTtsAuto.checked = state.settings.ttsAuto !== false;
  els.sTtsResult.textContent = tts.baseUrl ? `Bağlı: ${tts.baseUrl}` : 'Bağlı değil';
  if (state.settings.schoolLogoUrl) {
    els.sLogoPreview.innerHTML = `<img src="${escapeHtml(state.settings.schoolLogoUrl)}" alt="logo">`;
  } else {
    els.sLogoPreview.textContent = '🏫';
  }
  els.settingsModal.classList.remove('hidden');
}

function saveSettings() {
  state.settings = {
    schoolName: els.sSchool.value.trim() || DEFAULT_SETTINGS.schoolName,
    schoolPhone: els.sPhone.value.trim(),
    schoolAddress: els.sAddress.value.trim(),
    schoolLogoUrl: state.settings.schoolLogoUrl,
    ttsUrl: els.sTtsUrl.value.trim(),
    ttsAuto: els.sTtsAuto.checked,
  };
  saveJSON(SETTINGS_KEY, state.settings);
  applySettingsToRenderer();
  if (!state.fields.school.trim()) {
    applyFields({ ...state.fields, school: state.settings.schoolName });
  }
  els.settingsModal.classList.add('hidden');
  toast('Ayarlar kaydedildi');
  refreshVoiceStudio();
}

els.settingsBtn.addEventListener('click', openSettings);
els.settingsClose.addEventListener('click', () => els.settingsModal.classList.add('hidden'));
els.sSave.addEventListener('click', saveSettings);

els.sTtsTest.addEventListener('click', async () => {
  els.sTtsResult.textContent = 'Deneniyor…';
  const ok = await tts.discover({
    ttsUrl: els.sTtsUrl.value.trim(),
    ttsAuto: els.sTtsAuto.checked,
  });
  if (ok) {
    els.sTtsResult.textContent = `✓ Bağlandı: ${tts.baseUrl} (${tts.lastVoices.length} ses)`;
    els.sTtsResult.classList.add('ok');
  } else {
    els.sTtsResult.textContent = '✗ Ulaşılamadı — sunucunun çalıştığından emin olun.';
    els.sTtsResult.classList.remove('ok');
  }
});

els.sReset.addEventListener('click', () => {
  state.settings = { ...DEFAULT_SETTINGS };
  saveJSON(SETTINGS_KEY, state.settings);
  applySettingsToRenderer();
  els.sLogoPreview.textContent = '🏫';
  els.sSchool.value = DEFAULT_SETTINGS.schoolName;
  els.sPhone.value = '';
  els.sAddress.value = '';
  els.sTtsUrl.value = '';
  els.sTtsAuto.checked = true;
  els.sTtsResult.textContent = '';
  toast('Varsayılan ayarlara dönüldü');
});
els.sLogoInput.addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (f.size > 300 * 1024) { toast('Logo en fazla 300 KB olabilir.'); return; }
  const r = new FileReader();
  r.onload = () => {
    state.settings.schoolLogoUrl = r.result;
    els.sLogoPreview.innerHTML = `<img src="${escapeHtml(r.result)}" alt="logo">`;
  };
  r.readAsDataURL(f);
});
els.sLogoClear.addEventListener('click', () => {
  state.settings.schoolLogoUrl = null;
  els.sLogoPreview.textContent = '🏫';
});

els.settingsModal.addEventListener('click', (e) => {
  if (e.target === els.settingsModal) els.settingsModal.classList.add('hidden');
});
els.resultModal.addEventListener('click', (e) => {
  if (e.target === els.resultModal) els.resultModal.classList.add('hidden');
});

/* ---------------- Taslak ---------------- */

const scheduleDraftSave = debounce(() => {
  const a = state.audio;
  saveJSON(DRAFT_KEY, {
    fields: state.fields,
    templateId: state.templateId,
    sameCheck: state.sameCheck,
    audioInfo: a ? { kind: a.kind, name: a.name, duration: a.duration } : null,
  });
  els.draftState.textContent = 'kaydedildi';
  setTimeout(() => { els.draftState.textContent = ''; }, 2500);
}, 900);

els.draftBtn.addEventListener('click', () => {
  const d = loadJSON(DRAFT_KEY);
  if (!d) { toast('Henüz taslak yok.'); return; }
  exitDemo();
  state.templateId = d.templateId || state.templateId;
  renderer.setTemplate(VIDEO_TEMPLATES[state.templateId]);
  els.templateGrid.querySelectorAll('.tmpl-card').forEach((x) =>
    x.classList.toggle('active', x.dataset.id === state.templateId));
  applyFields(d.fields || {});
  state.sameCheck = !!d.sameCheck;
  updateReadiness();
  updateGenChecks();
  toast(d.audioInfo ? `Taslak yüklendi (ses: ${d.audioInfo.name} — yeniden yükleyin)` : 'Taslak yüklendi');
});

/* ---------------- Boş durum ---------------- */

function updateEmptyState() {
  const has = Object.values(state.fields).some((v) => (v || '').trim());
  els.stageEmpty.classList.toggle('hidden', demoMode || has || !!state.audio);
}

/* ---------------- Başlat ---------------- */

function init() {
  // form
  ['school', 'title', 'date', 'time', 'location', 'body', 'sign'].forEach((id) => {
    $(`#${id}`).addEventListener('input', syncFields);
  });

  renderer.setTemplate(VIDEO_TEMPLATES[state.templateId]);
  renderMsgTemplates();
  renderTemplateGrid();
  measureTimeline();

  // ayarları uygula
  applySettingsToRenderer();

  // taslak yükle ya da demo başlat
  const draft = loadJSON(DRAFT_KEY);
  if (draft && draft.fields) {
    state.templateId = draft.templateId || state.templateId;
    renderer.setTemplate(VIDEO_TEMPLATES[state.templateId]);
    els.templateGrid.querySelectorAll('.tmpl-card').forEach((x) =>
      x.classList.toggle('active', x.dataset.id === state.templateId));
    state.sameCheck = !!draft.sameCheck;
    applyFields(draft.fields);
    state.fields.school = state.fields.school || state.settings.schoolName;
  } else {
    applyFields({ school: state.settings.schoolName, ...DEFAULT_FIELDS });
    state.sameCheck = false;
    startDemo();
  }

  updateReadiness();
  updateGenChecks();

  // fontlar hazır olunca ilk kareyi çiz
  if (document.fonts && document.fonts.ready) {
    Promise.all([
      document.fonts.load('700 90px "Space Grotesk"'),
      document.fonts.load('600 40px "Inter"'),
      document.fonts.load('500 44px "Inter"'),
    ]).then(() => {
      renderCurrent();
      drawTimeline();
    });
  } else {
    renderCurrent();
    drawTimeline();
  }

  els.generateBtn.addEventListener('click', generate);

  // TTS sunucusunu ara (ses listesi + galeri)
  refreshVoiceStudio();
}

init();
