/* Veli Mesajı Studio — ana uygulama */

import {
  $, $$, clamp, clamp01, fmtClock, wordsOf, estimateSeconds,
  debounce, loadJSON, saveJSON, escapeHtml,
} from './utils.js';
import {
  VIDEO_TEMPLATES, TEMPLATE_ORDER, MESSAGE_TEMPLATES,
  DEFAULT_FIELDS, DEFAULT_SETTINGS,
} from './templates.js';
import { AudioEngine } from './audio.js';
import { buildScenes, SCENE_LABEL } from './scenes.js';
import { StudioRenderer } from './renderer.js';
import { PiperProvider, BrowserSpeechProvider, AI_VOICES } from './tts.js';
import {
  validateBeforeExport, exportVideo, downloadBlob, shareFile,
  waShareUrl, mailtoUrl,
} from './exporter.js';

const DRAFT_KEY = 'vms.v2.draft';
const SETTINGS_KEY = 'vms.v2.settings';
const MAX_SECONDS = 40;

/* ---------------- Durum ---------------- */

const state = {
  fields: { ...DEFAULT_FIELDS, school: '' },
  templateId: 'clean',
  audio: null, // { kind, name, blob, buffer, duration, peaks, url }
  sameCheck: false,
  settings: { ...DEFAULT_SETTINGS, ...loadJSON(SETTINGS_KEY, {}) },
};

const audioEngine = new AudioEngine();
const renderer = new StudioRenderer($('#stage'));
const piper = new PiperProvider();
const speech = new BrowserSpeechProvider();

let previewTime = 0;
let playing = false;
let rafId = null;
let fallbackClock = null; // ses bitince manuel saat
let lastResultUrl = null;
let lastResultName = 'veli-mesaji.mp4';

/* ---------------- Elemanlar ---------------- */

const els = {
  school: $('#school'), title: $('#title'), date: $('#date'), time: $('#time'),
  location: $('#location'), body: $('#body'), sign: $('#sign'),
  msgEstimate: $('#msgEstimate'), msgTemplates: $('#msgTemplates'),
  templateGrid: $('#templateGrid'), readiness: $('#readiness'),
  stageEmpty: $('#stageEmpty'),
  playBtn: $('#playBtn'), icPlay: $('.t-ic-play'), icPause: $('.t-ic-pause'),
  tCur: $('#tCur'), tDur: $('#tDur'), tNote: $('#tNote'),
  timeline: $('#timeline'),
  voiceTabs: $$('.tab', $('#voiceTabs')), tabBodies: $$('.tab-body'),
  voiceCards: $('#voiceCards'), ttsStatus: $('#ttsStatus'),
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

function hasDateInfo() {
  return !!(state.fields.date.trim() || state.fields.time.trim() || state.fields.location.trim());
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

/* ---------------- Form eşitleme ---------------- */

function syncFields() {
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
  const hasBody = !!state.fields.body.trim();
  const { scenes, videoDuration: vd } = buildScenes(currentDuration(), {
    hasDate: hasDateInfo(),
    hasBody,
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
  if (!hasAny && !state.audio) return;
  playing = true;
  setPlayingUI(true);
  fallbackClock = null;
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
    if (state.audio) {
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
    if (w > 46) {
      ctx.font = '600 10.5px Inter, sans-serif';
      ctx.fillStyle = active ? '#fff' : C.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(SCENE_LABEL[s.type], x + w / 2, 42);
    }
    // üst etiket
    if (w > 30) {
      ctx.font = '600 9px Inter, sans-serif';
      ctx.fillStyle = active ? C.primary : C.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(SCENE_LABEL[s.type], x + w / 2, 22);
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
    els.recHint.textContent = `Hedef: 40 sn altı`;
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

/* ---------------- Yapay ses ---------------- */

const SAMPLE_TEXT = 'Merhaba! Bu, veli mesajınızda kullanabileceğiniz örnek bir seslendirmedir.';

function renderVoiceCards() {
  els.voiceCards.innerHTML = '';
  AI_VOICES.forEach((v) => {
    const card = document.createElement('div');
    card.className = 'voice-card';
    card.innerHTML = `
      <div class="vc-top">
        <span class="vc-avatar">${v.gender === 'Kadın' ? '♀' : '♂'}</span>
        <div class="vc-meta">
          <div class="vc-name">${escapeHtml(v.label)}</div>
          <div class="vc-tag">${escapeHtml(v.tag)}</div>
        </div>
        <span class="vc-size">~${v.sizeMB} MB</span>
      </div>
      <p class="vc-desc">${escapeHtml(v.desc)}</p>
      <div class="vc-actions">
        <button type="button" class="btn btn-sm ghost" data-act="sample">▶ Örnek Dinle</button>
        <button type="button" class="btn btn-sm" data-act="generate">Bu sesle oluştur</button>
      </div>`;
    card.querySelector('[data-act="sample"]').addEventListener('click', () => sampleVoice(v, card));
    card.querySelector('[data-act="generate"]').addEventListener('click', () => generateVoice(v, card));
    els.voiceCards.append(card);
  });
}

function setTtsStatus(type, html) {
  els.ttsStatus.className = 'tts-status' + (type ? ' ' + type : '');
  els.ttsStatus.innerHTML = html || '';
}

function sampleVoice(v) {
  if (!BrowserSpeechProvider.supported()) {
    setTtsStatus('warn', `Bu cihazda hızlı örnek okunamıyor. "Bu sesle oluştur" ile gerçek ${v.label} sesini dinleyebilirsiniz.`);
    return;
  }
  speech.stop();
  speech.speak(SAMPLE_TEXT, {
    onEnd: () => { if (els.ttsStatus.classList.contains('sample')) setTtsStatus(''); },
  });
  setTtsStatus('sample', `🔊 ${v.label} örneği okunuyor (cihaz sesi)…`);
}

function setVoiceBusy(card, busy, label) {
  card.querySelectorAll('button').forEach((b) => { b.disabled = busy; });
  if (busy) card.classList.add('busy');
  else card.classList.remove('busy');
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
  setTtsStatus('busy', `<div class="busy-row"><span class="spinner"></span><div>${escapeHtml(v.label)} hazırlanıyor — ilk kullanımda ses modeli indirilir, biraz sürebilir.</div></div><div class="mini-bar"><div class="mini-fill" id="ttsFill"></div></div>`);
  try {
    const res = await piper.generate(
      text,
      v.id,
      (p) => { const f = $('#ttsFill'); if (f) f.style.width = `${Math.round(p * 100)}%`; },
      (msg) => {
        const row = els.ttsStatus.querySelector('.busy-row div');
        if (row && msg) row.textContent = msg;
      }
    );
    await setAudio({ kind: 'ai', name: `${v.label} sesi`, blob: res.blob });
    setTtsStatus('ok', `✓ ${v.label} ile seslendirildi — ${fmtClock(state.audio.duration, true)}`);
    toast(`Ses oluşturuldu: ${v.label}`);
  } catch (err) {
    console.error('TTS hatası:', err);
    setTtsStatus('error',
      `Seslendirme oluşturulamadı: ${escapeHtml(err.message || 'bilinmeyen hata')}<br>` +
      'İnternet bağlantısını kontrol edin ya da <b>Kayıt</b> / <b>Dosya</b> sekmelerinden ses ekleyin.');
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
    console.error(err);
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
  els.sameCheck = false;
  applyFields({ school: state.settings.schoolName, title: '', date: '', time: '', location: '', body: '', sign: '' });
  toast('Yeni duyuru için alanlar temizlendi');
});

els.resultClose.addEventListener('click', () => {
  els.resultModal.classList.add('hidden');
  els.resultVideo.pause();
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
  };
  saveJSON(SETTINGS_KEY, state.settings);
  applySettingsToRenderer();
  if (!state.fields.school.trim()) {
    applyFields({ ...state.fields, school: state.settings.schoolName });
  }
  els.settingsModal.classList.add('hidden');
  toast('Ayarlar kaydedildi');
}

els.settingsBtn.addEventListener('click', openSettings);
els.settingsClose.addEventListener('click', () => els.settingsModal.classList.add('hidden'));
els.sSave.addEventListener('click', saveSettings);
els.sReset.addEventListener('click', () => {
  state.settings = { ...DEFAULT_SETTINGS };
  saveJSON(SETTINGS_KEY, state.settings);
  applySettingsToRenderer();
  els.sLogoPreview.textContent = '🏫';
  els.sSchool.value = DEFAULT_SETTINGS.schoolName;
  els.sPhone.value = '';
  els.sAddress.value = '';
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
  els.stageEmpty.classList.toggle('hidden', has || !!state.audio);
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
  renderVoiceCards();
  measureTimeline();

  // ayarları uygula
  applySettingsToRenderer();

  // taslak yükle
  const draft = loadJSON(DRAFT_KEY);
  if (draft && draft.fields) {
    state.templateId = draft.templateId || state.templateId;
    renderer.setTemplate(VIDEO_TEMPLATES[state.templateId]);
    els.templateGrid.querySelectorAll('.tmpl-card').forEach((x) =>
      x.classList.toggle('active', x.dataset.id === state.templateId));
    state.sameCheck = !!draft.sameCheck;
    applyFields(draft.fields);
  } else {
    applyFields({ school: state.settings.schoolName, ...DEFAULT_FIELDS });
    state.sameCheck = false;
  }

  syncFields();
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
}

init();
