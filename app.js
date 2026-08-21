'use strict';

/* ================= Yardımcılar ================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  school: '',
  title: '',
  body: '',
  sign: '',
  audio: null, // { blob, url, mime, ext, name, size, duration }
};

const els = {
  school: $('#school'),
  title: $('#title'),
  body: $('#body'),
  sign: $('#sign'),
  bodyCount: $('#bodyCount'),
  templateButtons: $('#templateButtons'),
  recordBtn: $('#recordBtn'),
  stopBtn: $('#stopBtn'),
  recLabel: $('#recLabel'),
  recBar: $('#recBar'),
  recTimer: $('#recTimer'),
  recHint: $('#recHint'),
  recErr: $('#recErr'),
  fileInput: $('#fileInput'),
  audioChip: $('#audioChip'),
  chipName: $('#chipName'),
  chipDur: $('#chipDur'),
  chipPlay: $('#chipPlay'),
  chipRemove: $('#chipRemove'),
  sameCheck: $('#sameCheck'),
  sameMark: $('#sameMark'),
  contactMark: $('#contactMark'),
  exportBtn: $('#exportBtn'),
  exportNote: $('#exportNote'),
  linkBtn: $('#linkBtn'),
  clearBtn: $('#clearBtn'),
  prevSchool: $('#prevSchool'),
  prevTitle: $('#prevTitle'),
  prevBody: $('#prevBody'),
  prevSign: $('#prevSign'),
  audioCard: $('#audioCard'),
  playBtn: $('#playBtn'),
  icPlay: $('.ic-play'),
  icPause: $('.ic-pause'),
  eq: $('#eq'),
  audioName: $('#audioName'),
  seek: $('#seek'),
  timeCur: $('#timeCur'),
  timeDur: $('#timeDur'),
  ttsBtn: $('#ttsBtn'),
  noAudioNote: $('#noAudioNote'),
  toast: $('#toast'),
};

/* ================= Şablonlar ================= */
const TEMPLATES = [
  {
    label: '🗓️ Toplantı hatırlatması',
    title: 'Değerli Velilerimiz',
    body: 'Çocuklarımızın gelişimini birlikte konuşmak için 25 Eylül Perşembe günü saat 14.30\'da okulumuzda veli toplantısı düzenliyoruz.\nKatılımınız bizim için çok değerli. Sorularınız için bizi okul numaramızdan arayabilirsiniz.\nGörüşmek dileğiyle, sevgilerimizle.',
    sign: 'Sınıf Öğretmeni Ayşe Yılmaz',
  },
  {
    label: '📚 Ödev bilgilendirmesi',
    title: 'Sevgili Velilerimiz',
    body: 'Haftalık ödevlerimiz her pazartesi günü e-okul sistemine yükleniyor.\nÖdevlerin takibi için her akşam 15 dakika ayırmanızı rica ediyoruz.\nÖdevlerde zorlanan öğrenciler için çarşamba günleri 14.00 - 15.00 arası okulumuzda destek çalışması yapıyoruz.',
    sign: '4-A Sınıf Öğretmeni',
  },
  {
    label: '🚌 Okul gezisi',
    title: 'Değerli Velilerimiz',
    body: '4 Ekim Cuma günü doğa bilimleri müzesine okul gezisi düzenliyoruz.\nKatılım için izin belgesini en geç 30 Eylül Pazartesi gününe kadar sınıf öğretmenine teslim etmeniz gerekiyor.\nGezi ücreti 350 TL olup ayrıntılar izin belgesinde yazmaktadır.\nİyi günler dileriz.',
    sign: 'Okul Yönetimi',
  },
  {
    label: '📢 Genel duyuru',
    title: 'Sevgili Velilerimiz',
    body: 'Yarın okulumuzda planlı elektrik çalışması yapılacağı için dersler saat 10.00\'da başlayacak.\nTüm öğrencilerimizin 10.00\'a kadar okulda olması gerekmektedir.\nAnlayışınız için teşekkür ederiz.',
    sign: 'Okul İdaresi',
  },
];

const DEFAULT_TEMPLATE = TEMPLATES[0];

/* ================= Ses formatı ================= */
function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const list = [
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  return list.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}
function extForMime(mime) {
  if (!mime) return 'webm';
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

/* ================= Toast ================= */
let toastTimer = null;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  requestAnimationFrame(() => els.toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
    setTimeout(() => els.toast.classList.add('hidden'), 300);
  }, 3200);
}

/* ================= Önizleme ================= */
function renderPreview() {
  els.prevSchool.textContent = state.school;
  els.prevSchool.style.opacity = state.school ? '' : '0';

  const t = state.title.trim();
  els.prevTitle.innerHTML = '';
  if (t.length <= 60 && t.length > 0) {
    [...t].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'lt';
      s.textContent = ch;
      s.style.animationDelay = `${(0.06 * i).toFixed(2)}s`;
      els.prevTitle.append(s);
    });
  } else {
    els.prevTitle.textContent = t;
  }

  els.prevBody.innerHTML = '';
  state.body
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const p = document.createElement('p');
      p.textContent = line;
      p.style.animationDelay = `${(0.2 + 0.12 * i).toFixed(2)}s`;
      els.prevBody.append(p);
    });

  els.prevSign.textContent = state.sign;

  updateAudioUI();
  updateChecklist();
}

function updateAudioUI() {
  const has = !!state.audio;
  els.audioCard.style.display = has ? 'flex' : 'none';
  els.noAudioNote.classList.toggle('show', !has);
  if (!has) return;

  const a = state.audio;
  els.audioName.textContent = a.name;
  els.chipName.textContent = a.name;
  els.chipDur.textContent = fmtTime(a.duration);
}

/* ================= Zaman biçimleme ================= */
function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ================= Ses oynatma (önizleme) ================= */
const player = new Audio();
player.preload = 'metadata';
let seeking = false;

function setPlaying(on) {
  els.playBtn.classList.toggle('playing', on);
  els.eq.classList.toggle('playing', on);
  els.eq.classList.toggle('paused', !on);
  els.icPlay.style.display = on ? 'none' : '';
  els.icPause.style.display = on ? '' : 'none';
}

function togglePlay() {
  if (!state.audio) return;
  if (player.src !== state.audio.url) {
    player.src = state.audio.url;
    player.load();
  }
  if (player.paused) {
    player.play().catch(() => toast('Ses oynatılamadı.'));
  } else {
    player.pause();
    setPlaying(false);
  }
}

player.addEventListener('timeupdate', () => {
  if (!seeking && isFinite(player.duration)) {
    els.timeCur.textContent = fmtTime(player.currentTime);
    els.seek.value = String(Math.round((player.currentTime / player.duration) * 1000));
  }
});
player.addEventListener('loadedmetadata', () => {
  els.timeDur.textContent = fmtTime(player.duration);
  els.seek.max = '1000';
});
player.addEventListener('play', () => setPlaying(true));
player.addEventListener('pause', () => setPlaying(false));
player.addEventListener('ended', () => setPlaying(false));

els.playBtn.addEventListener('click', togglePlay);
els.seek.addEventListener('input', () => {
  seeking = true;
  if (isFinite(player.duration)) {
    const v = Number(els.seek.value) / 1000;
    player.currentTime = v * player.duration;
    els.timeCur.textContent = fmtTime(player.currentTime);
  }
});
els.seek.addEventListener('change', () => { seeking = false; });

/* ================= Metni sesli okuma (TTS) ================= */
function fullText() {
  return [state.title.trim(), state.body.trim(), state.sign.trim()].filter(Boolean).join('. ');
}
let speaking = false;
els.ttsBtn.addEventListener('click', () => {
  if (!('speechSynthesis' in window) || !window.speechSynthesis) {
    toast('Tarayıcınız metni sesli okumayı desteklemiyor.');
    return;
  }
  if (speaking) {
    speechSynthesis.cancel();
    speaking = false;
    els.ttsBtn.textContent = '🔊 Sesli dinle (metni okur)';
    return;
  }
  const text = fullText();
  if (!text) { toast('Önce bir mesaj yazın.'); return; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'tr-TR';
  u.rate = 1;
  const tr = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('tr'));
  if (tr) u.voice = tr;
  u.onend = () => { speaking = false; els.ttsBtn.textContent = '🔊 Sesli dinle (metni okur)'; };
  u.onerror = () => { speaking = false; els.ttsBtn.textContent = '🔊 Sesli dinle (metni okur)'; };
  speaking = true;
  els.ttsBtn.textContent = '⏹ Okumayı durdur';
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
});

/* ================= Kayıt ================= */
let recorder = null;
let chunks = [];
let stream = null;
let recTimerId = null;
let recSeconds = 0;

function fmtRec(sec) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

function updateRecUI() {
  els.recTimer.textContent = fmtRec(recSeconds);
  const pct = Math.min(100, (recSeconds / 40) * 100);
  els.recBar.style.width = `${pct}%`;
  els.recBar.classList.remove('warn', 'bad');
  els.recHint.classList.remove('ok', 'warn', 'bad');
  if (recSeconds <= 40) {
    els.recHint.textContent = 'Hedef: 40 saniyenin altı';
    els.recHint.classList.add('ok');
  } else if (recSeconds <= 60) {
    els.recBar.classList.add('warn');
    els.recHint.textContent = '40 saniye doldu — kısaltmayı düşünün';
    els.recHint.classList.add('warn');
  } else {
    els.recBar.classList.add('bad');
    els.recHint.textContent = 'Çok uzun — mesajlar kısa olunca daha çok dinlenir';
    els.recHint.classList.add('bad');
  }
}

async function startRecording() {
  if (recorder) return;
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    showRecErr('Tarayıcınız mikrofon kaydını desteklemiyor. Lütfen güncel Chrome, Edge veya Firefox kullanın.');
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    showRecErr('Mikrofona erişilemedi. İzin verdiğinizden emin olun ya da yukarıdan ses dosyası yükleyin.');
    return;
  }
  const mime = pickMimeType();
  chunks = [];
  try {
    recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  } catch (err) {
    showRecErr('Ses kaydı başlatılamadı. Ses dosyası yüklemeyi deneyin.');
    stopStream();
    return;
  }
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = onRecordingStop;
  recorder.start();
  recSeconds = 0;
  updateRecUI();
  els.recTimer.textContent = '00:00';
  els.recLabel.textContent = 'Kaydediliyor…';
  els.recordBtn.classList.add('recording');
  els.recordBtn.title = 'Kayıt devam ediyor';
  els.stopBtn.classList.remove('hidden');
  els.recErr.classList.add('hidden');
  recTimerId = setInterval(() => {
    recSeconds += 1;
    updateRecUI();
    if (recSeconds >= 120) stopRecording();
  }, 1000);
}

function stopRecording() {
  if (!recorder) return;
  clearInterval(recTimerId);
  recTimerId = null;
  try { recorder.stop(); } catch (e) { /* yok say */ }
}

function onRecordingStop() {
  const rec = recorder;
  recorder = null;
  stopStream();
  els.recordBtn.classList.remove('recording');
  els.recordBtn.title = 'Mikrofonla kaydet';
  els.stopBtn.classList.add('hidden');
  els.recLabel.textContent = 'Kayıt başlat';

  const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
  chunks = [];
  if (blob.size === 0) {
    showRecErr('Kayıt boş görünüyor. Mikrofonun kapalı olmadığından emin olup tekrar deneyin.');
    return;
  }
  els.recErr.classList.add('hidden');
  const mime = rec.mimeType || pickMimeType();
  const ext = extForMime(mime);
  setAudio({ blob, mime, name: `veli-ses-mesaji.${ext}` });
}

function stopStream() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

function showRecErr(msg) {
  els.recErr.textContent = msg;
  els.recErr.classList.remove('hidden');
}

els.recordBtn.addEventListener('click', startRecording);
els.stopBtn.addEventListener('click', stopRecording);

/* ================= Dosya yükleme ================= */
function setAudio({ blob, mime, name }) {
  if (state.audio) URL.revokeObjectURL(state.audio.url);
  const url = URL.createObjectURL(blob);
  const probe = new Audio();
  probe.preload = 'metadata';
  probe.src = url;
  probe.onloadedmetadata = () => {
    state.audio = {
      blob, url, mime: mime || 'audio/mpeg',
      ext: extForMime(mime || 'audio/mpeg'),
      name: name || 'veli-ses-mesaji',
      size: blob.size,
      duration: probe.duration,
    };
    els.audioChip.classList.remove('hidden');
    updateAudioUI();
    updateChecklist();
    // Kayıt/değişim sonrası önizleme oynatıcısını yeni sese bağla
    if (!player.paused) player.pause();
    player.removeAttribute('src');
    player.load();
  };
  probe.onerror = () => {
    URL.revokeObjectURL(url);
    toast('Bu ses dosyası okunamadı. Başka bir format deneyin (MP3, M4A, OGG, WAV).');
  };
}

els.fileInput.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 25 * 1024 * 1024) {
    toast('Dosya 25 MB\'dan büyük. Daha kısa bir kayıt deneyin.');
    return;
  }
  setAudio({ blob: file, mime: file.type, name: file.name });
});

els.chipPlay.addEventListener('click', togglePlay);
els.chipRemove.addEventListener('click', () => {
  if (state.audio) URL.revokeObjectURL(state.audio.url);
  state.audio = null;
  els.audioChip.classList.add('hidden');
  player.pause();
  player.removeAttribute('src');
  player.load();
  setPlaying(false);
  els.timeCur.textContent = '0:00';
  els.timeDur.textContent = '0:00';
  els.seek.value = '0';
  updateAudioUI();
  updateChecklist();
});

/* ================= Kontrol listesi ================= */
function setItem(name, cls, html) {
  const li = $(`.checklist li[data-item="${name}"]`);
  li.classList.remove('ok', 'warn', 'bad', 'neutral');
  li.classList.add(cls);
  const mark = $('.chk-mark', li);
  const icons = { ok: '✓', warn: '!', bad: '✕', neutral: '·' };
  mark.textContent = icons[cls] || '·';
  if (name === 'same') return;
  const text = $('.chk-text', li);
  if (text) text.textContent = html;
}

function updateChecklist() {
  // 1) Ses süresi
  if (state.audio) {
    const d = state.audio.duration;
    if (d <= 40) setItem('duration', 'ok', 'Ses 40 saniyenin altında');
    else if (d <= 60) setItem('duration', 'warn', `Ses ${Math.round(d)} saniye — 40 saniyenin üzerinde`);
    else setItem('duration', 'bad', `Ses ${Math.round(d)} saniye — çok uzun, kısaltın`);
  } else {
    setItem('duration', 'neutral', 'Ses eklenmedi — kart "Sesli dinle" ile okunur, ama ses kaydı önerilir');
  }

  // 2) Metin ↔ ses aynı bilgi (manuel)
  if (els.sameCheck.checked) {
    els.sameMark.textContent = '✓';
    $('#checklist li[data-item="same"]').classList.remove('warn', 'bad', 'neutral');
    $('#checklist li[data-item="same"]').classList.add('ok');
  } else {
    els.sameMark.textContent = '…';
    $('#checklist li[data-item="same"]').classList.remove('ok', 'bad');
    $('#checklist li[data-item="same"]').classList.add(state.audio ? 'warn' : 'neutral');
  }

  // 3) Tarih / saat / iletişim
  const body = state.body;
  const hasInfo =
    /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(body) ||        // tarih
    /\d{1,2}[:.]\d{2}/.test(body) ||                        // saat
    /\b(\+90|0\d{2,3})\s?\d{3}\s?\d{2}\s?\d{2}\b/.test(body) || // telefon
    /\b(telefon|arayabilir|ulaşabilir|iletişim|whatsapp|numara)\b/i.test(body) ||
    /(yarın|pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar)/i.test(body);
  if (hasInfo) setItem('contact', 'ok', 'Mesajda tarih, saat veya iletişim bilgisi var');
  else setItem('contact', 'warn', 'Tarih, saat veya iletişim bilgisi bulunamadı — ekleyin');
}

els.sameCheck.addEventListener('change', updateChecklist);

/* ================= Dışa aktarma ================= */
function readAsDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Ses okunamadı'));
    r.readAsDataURL(blob);
  });
}

async function exportHTML() {
  if (state.audio && !els.sameCheck.checked) {
    if (!confirm('Ses kaydını dinleyip metinle aynı bilgiyi verdiğini kontrol ettiniz mi?\n\nKontrol ettiyseniz "Tamam" deyip devam edin.')) return;
  }
  els.exportBtn.disabled = true;
  els.exportBtn.textContent = '⏳ Hazırlanıyor…';
  try {
    const audioData = state.audio ? await readAsDataURL(state.audio.blob) : null;
    const data = {
      school: state.school.trim(),
      title: state.title.trim() || 'Değerli Velilerimiz',
      body: state.body.trim(),
      sign: state.sign.trim(),
      audioData,
      audioName: state.audio ? state.audio.name : '',
    };
    const html = buildExportHTML(data);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `veli-mesaji-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);

    const mb = blob.size / (1024 * 1024);
    els.exportNote.textContent = mb > 4
      ? `Dosya ${mb.toFixed(1)} MB — WhatsApp büyük dosyaları sıkıştırabilir. Sesi 40 saniyenin altında kısaltmak dosyayı küçültür.`
      : `✅ ${mb.toFixed(1)} MB hazır. Bu dosyayı velilere gönderin; açan herkes görsel kartı görür, sesi dinler.`;
    toast('HTML dosyası indirildi — velilere gönderin!');
  } catch (err) {
    toast('Dışa aktarma başarısız: ' + err.message);
  } finally {
    els.exportBtn.disabled = false;
    els.exportBtn.textContent = '📄 İndir — Tek HTML dosyası (görsel + ses + hareket)';
  }
}

function buildExportHTML(data) {
  // </script> benzeri diziler metinde geçerse gömülü betiği bozmasın diye kaçış yapılır
  const json = JSON.stringify(data).replace(/<\//g, '<\\/');
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(data.title)}</title>
<style>
  :root{--c1:#7c3aed;--c2:#db2777;--c3:#f59e0b}
  *{box-sizing:border-box}
  html,body{height:100%}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
    background:#faf6f0;display:flex;align-items:center;justify-content:center;padding:18px}
  .card{position:relative;overflow:hidden;width:100%;max-width:520px;border-radius:24px;color:#fff;
    background:linear-gradient(135deg,var(--c1),var(--c2),var(--c3),var(--c1));background-size:300% 300%;
    animation:shift 14s ease infinite;box-shadow:0 24px 60px rgba(60,40,20,.28);padding:36px 28px 26px}
  @keyframes shift{0%{background-position:0 50%}50%{background-position:100% 50%}100%{background-position:0 50%}}
  .blob{position:absolute;border-radius:50%;filter:blur(34px);background:rgba(255,255,255,.16);pointer-events:none}
  .b1{width:190px;height:190px;top:-50px;right:-40px;animation:f1 11s ease-in-out infinite}
  .b2{width:150px;height:150px;bottom:-40px;left:-30px;animation:f2 13s ease-in-out infinite}
  .b3{width:90px;height:90px;top:40%;left:12%;animation:f3 9s ease-in-out infinite}
  @keyframes f1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-28px,30px) scale(1.12)}}
  @keyframes f2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(24px,-26px) scale(1.15)}}
  @keyframes f3{0%,100%{transform:translate(0,0) scale(1);opacity:.8}50%{transform:translate(18px,18px) scale(1.2);opacity:1}}
  .in{position:relative;z-index:1;display:flex;flex-direction:column}
  .school{font-size:12.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;opacity:.85;margin-bottom:10px;min-height:16px}
  h1{margin:0 0 12px;font-size:27px;font-weight:800;line-height:1.25;letter-spacing:-.3px;text-shadow:0 2px 12px rgba(0,0,0,.18)}
  .lt{display:inline-block;opacity:0;animation:up .5s cubic-bezier(.2,.7,.3,1) forwards}
  @keyframes up{from{opacity:0;transform:translateY(14px) scale(.9)}to{opacity:1;transform:translateY(0) scale(1)}}
  .body{display:grid;gap:8px;margin-bottom:18px}
  .body p{margin:0;font-size:15.5px;line-height:1.6;opacity:0;animation:pup .55s ease forwards}
  @keyframes pup{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  .sign{margin-top:18px;font-size:15px;font-weight:700;opacity:0;animation:pup .55s .3s ease forwards}
  .audio{display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.35);
    border-radius:16px;padding:12px 16px}
  .play{flex:0 0 auto;width:54px;height:54px;border-radius:50%;border:none;cursor:pointer;background:rgba(255,255,255,.95);
    color:var(--c2);display:inline-flex;align-items:center;justify-content:center;position:relative;box-shadow:0 6px 16px rgba(0,0,0,.22);transition:transform .15s}
  .play:hover{transform:scale(1.07)}
  .play.playing::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:3px solid rgba(255,255,255,.55);animation:ring 1.4s ease-out infinite}
  @keyframes ring{0%{transform:scale(.85);opacity:1}100%{transform:scale(1.35);opacity:0}}
  .eq{display:flex;gap:3px;align-items:flex-end;height:26px;flex:0 0 auto}
  .eq span{width:4px;height:6px;border-radius:2px;background:rgba(255,255,255,.55);animation:eq 1s ease-in-out infinite}
  .eq span:nth-child(2){animation-delay:.15s}.eq span:nth-child(3){animation-delay:.3s}.eq span:nth-child(4){animation-delay:.45s}.eq span:nth-child(5){animation-delay:.6s}
  @keyframes eq{0%,100%{height:6px}50%{height:24px}}
  .eq.playing span{background:#fff;height:24px}
  .meta{flex:1;min-width:0}
  .name{font-size:13.5px;font-weight:700;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .seek{width:100%;accent-color:#fff;cursor:pointer}
  .time{font-size:12px;opacity:.85;margin-top:2px;font-variant-numeric:tabular-nums}
  .tts{margin-top:12px}
  .ttsBtn{font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;background:rgba(255,255,255,.22);color:#fff;
    border:1px solid rgba(255,255,255,.45);border-radius:12px;padding:9px 14px;transition:background .15s}
  .ttsBtn:hover{background:rgba(255,255,255,.32)}
  .note{margin-top:12px;font-size:12.5px;opacity:.85}
  .foot{margin-top:22px;text-align:center;font-size:12px;color:#8a7f72}
</style>
</head>
<body>
  <div class="card">
    <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
    <div class="in">
      <div class="school" id="school"></div>
      <h1 id="title"></h1>
      <div class="body" id="body"></div>
      <div class="audio" id="audioCard">
        <div class="eq" id="eq"><span></span><span></span><span></span><span></span><span></span></div>
        <button class="play" id="play" title="Oynat / duraklat">
          <svg class="p1" viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          <svg class="p2" viewBox="0 0 24 24" width="30" height="30" fill="currentColor" style="display:none"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
        </button>
        <div class="meta">
          <div class="name" id="name">Sesli mesaj</div>
          <input type="range" class="seek" id="seek" min="0" max="1000" value="0" step="1">
          <div class="time"><span id="cur">0:00</span> / <span id="dur">0:00</span></div>
        </div>
      </div>
      <div class="tts" id="ttsBox"><button class="ttsBtn" id="tts">🔊 Sesli dinle</button></div>
      <div class="note" id="note"></div>
      <div class="sign" id="sign"></div>
    </div>
  </div>
  <div class="foot">Görsel + Ses + Hareket ile hazırlandı 💌</div>

<script>
(function(){
  var data = ${json};
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  document.getElementById('school').textContent = data.school;
  var t = data.title;
  var h = document.getElementById('title');
  if (t.length <= 60) {
    for (var i=0;i<t.length;i++){
      var s=document.createElement('span');s.className='lt';s.textContent=t[i];
      s.style.animationDelay=(0.06*i).toFixed(2)+'s';h.appendChild(s);
    }
  } else { h.textContent = t; }
  var bd = document.getElementById('body');
  data.body.split(/\\n+/).map(function(l){return l.trim();}).filter(Boolean).forEach(function(line,i){
    var p=document.createElement('p');p.textContent=line;
    p.style.animationDelay=(0.2+0.12*i).toFixed(2)+'s';bd.appendChild(p);
  });
  document.getElementById('sign').textContent = data.sign;
  var hasAudio = !!data.audioData;
  var audioCard = document.getElementById('audioCard');
  var note = document.getElementById('note');
  if (!hasAudio) {
    audioCard.style.display='none';
    note.textContent='Bu mesajda kayıtlı ses yok — "Sesli dinle" ile okunur.';
  } else {
    document.getElementById('name').textContent = data.audioName || 'Sesli mesaj';
  }
  var audio = new Audio();
  audio.src = data.audioData || '';
  var play=document.getElementById('play'), p1=document.querySelector('.p1'), p2=document.querySelector('.p2');
  var eq=document.getElementById('eq'), seek=document.getElementById('seek');
  var cur=document.getElementById('cur'), dur=document.getElementById('dur');
  function fmt(s){s=Math.max(0,isFinite(s)?Math.floor(s):0);var m=Math.floor(s/60);var x=s%60;return m+':'+(x<10?'0':'')+x;}
  function setPlay(on){
    play.classList.toggle('playing',on);eq.classList.toggle('playing',on);
    p1.style.display=on?'none':'';p2.style.display=on?'':'none';
  }
  play.addEventListener('click',function(){
    if(!hasAudio)return;
    if(audio.paused){audio.play().catch(function(){alert('Ses oynatılamadı.');});}else{audio.pause();setPlay(false);}
  });
  audio.addEventListener('timeupdate',function(){
    if(isFinite(audio.duration)){cur.textContent=fmt(audio.currentTime);seek.value=Math.round(audio.currentTime/audio.duration*1000);}
  });
  audio.addEventListener('loadedmetadata',function(){dur.textContent=fmt(audio.duration);});
  audio.addEventListener('play',function(){setPlay(true);});
  audio.addEventListener('pause',function(){setPlay(false);});
  audio.addEventListener('ended',function(){setPlay(false);});
  seek.addEventListener('input',function(){if(isFinite(audio.duration)){audio.currentTime=(seek.value/1000)*audio.duration;cur.textContent=fmt(audio.currentTime);}});
  var ttsBtn=document.getElementById('tts'),speaking=false;
  ttsBtn.addEventListener('click',function(){
    if(!('speechSynthesis' in window) || !window.speechSynthesis){alert('Tarayıcınız sesli okumayı desteklemiyor.');return;}
    if(speaking){speechSynthesis.cancel();speaking=false;ttsBtn.textContent='🔊 Sesli dinle';return;}
    var txt=[data.title,data.body,data.sign].filter(Boolean).join('. ');
    var u=new SpeechSynthesisUtterance(txt);u.lang='tr-TR';u.rate=1;
    var v=speechSynthesis.getVoices().filter(function(v){return v.lang.toLowerCase().indexOf('tr')===0;})[0];
    if(v)u.voice=v;
    u.onend=function(){speaking=false;ttsBtn.textContent='🔊 Sesli dinle';};
    u.onerror=function(){speaking=false;ttsBtn.textContent='🔊 Sesli dinle';};
    speaking=true;ttsBtn.textContent='⏹ Okumayı durdur';
    speechSynthesis.cancel();speechSynthesis.speak(u);
  });
})();
</script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ================= Bağlantı paylaşımı ================= */
function encodePayload(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodePayload(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

els.linkBtn.addEventListener('click', () => {
  const payload = { s: state.school, t: state.title, b: state.body, g: state.sign };
  const url = location.origin + location.pathname + '#v=' + encodePayload(payload);
  navigator.clipboard.writeText(url).then(
    () => toast('Metin bağlantısı kopyalandı. (Ses dosyasını ayrıca gönderin — bağlantı yalnızca metni taşır.)'),
    () => { prompt('Bağlantıyı kopyalayın:', url); }
  );
});

function parseShare() {
  const m = location.hash.match(/^#v=(.+)$/);
  if (!m) return;
  try {
    const d = decodePayload(m[1]);
    els.school.value = d.s || '';
    els.title.value = d.t || '';
    els.body.value = d.b || '';
    els.sign.value = d.g || '';
    syncFromInputs();
    toast('Mesaj bağlantıdan yüklendi. Sesi ekleyip gönderebilirsiniz.');
  } catch (e) {
    toast('Bağlantı okunamadı.');
  }
}

/* ================= Form eşitleme ================= */
function syncFromInputs() {
  state.school = els.school.value;
  state.title = els.title.value;
  state.body = els.body.value;
  state.sign = els.sign.value;
  els.bodyCount.textContent = `${els.body.value.length}/2000`;
  renderPreview();
}

function onInput() {
  syncFromInputs();
}

['school', 'title', 'body', 'sign'].forEach((id) => {
  $(`#${id}`).addEventListener('input', onInput);
});

/* ================= Şablonlar ================= */
function fillTemplate(tpl) {
  els.school.value = '';
  els.title.value = tpl.title;
  els.body.value = tpl.body;
  els.sign.value = tpl.sign;
  syncFromInputs();
  toast(`Şablon yüklendi: ${tpl.label}`);
}

TEMPLATES.forEach((tpl) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tmpl-btn';
  b.textContent = tpl.label;
  b.addEventListener('click', () => fillTemplate(tpl));
  els.templateButtons.append(b);
});

/* ================= Temizle ================= */
els.clearBtn.addEventListener('click', () => {
  if (!confirm('Tüm metni ve sesi temizleyeyim mi?')) return;
  els.school.value = '';
  els.title.value = '';
  els.body.value = '';
  els.sign.value = '';
  els.sameCheck.checked = false;
  if (state.audio) {
    URL.revokeObjectURL(state.audio.url);
    state.audio = null;
    els.audioChip.classList.add('hidden');
    player.pause();
    player.removeAttribute('src');
    player.load();
    setPlaying(false);
    els.timeCur.textContent = '0:00';
    els.timeDur.textContent = '0:00';
    els.seek.value = '0';
  }
  syncFromInputs();
});

/* ================= Başlat ================= */
els.exportBtn.addEventListener('click', exportHTML);

fillTemplate(DEFAULT_TEMPLATE);
parseShare();

// TTS ses listesi hazır olsun (Chrome)
if (window.speechSynthesis && typeof window.speechSynthesis.getVoices === 'function') {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}
