/* Veli Mesajı Studio — testler
 * Çalıştırma: npm test
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mod = (p) => import(pathToFileURL(join(root, p)).href);

/* ---------- 1) Sahne motoru (saf mantık) ---------- */
const { buildScenes } = await mod('js/scenes.js');

{
  const D = 28.4;
  const { scenes, videoDuration } = buildScenes(D, {
    hasDate: true, hasTime: true, hasLocation: true, hasBody: true,
  });
  assert.equal(scenes.length, 7, '7 sahne olmalı (intro,title,date,time,location,message,outro)');
  assert.equal(scenes[0].type, 'intro');
  assert.equal(scenes[6].type, 'outro');
  const types = scenes.map((s) => s.type);
  assert.deepEqual(types, ['intro', 'title', 'date', 'time', 'location', 'message', 'outro']);
  assert.ok(scenes.every((s) => s.id && s.animation), 'her sahnenin id ve animation alanı olmalı');
  const sum = scenes.reduce((a, s) => a + s.dur, 0);
  assert.ok(Math.abs(sum - videoDuration) < 0.001, 'süreler toplamı videoDuration olmalı');
  assert.ok(Math.abs(videoDuration - (D + 0.7)) < 0.001, `bitiş kuyruğu: ${videoDuration} ≈ ${D + 0.7}`);
  scenes.forEach((s, i) => {
    if (i > 0) assert.ok(Math.abs(s.start - scenes[i - 1].end) < 0.001, 'sahneler ardışık olmalı');
  });
  const { sceneAt } = await mod('js/scenes.js');
  assert.equal(sceneAt(scenes, 0).type, 'intro');
  assert.equal(sceneAt(scenes, scenes[1].start).type, 'title');
  console.log('✓ buildScenes: 7 sahne, süre dağılımı, ardışıklık, sceneAt');
}

{
  // koşullu sahneler
  const { scenes } = buildScenes(20, { hasDate: true, hasTime: false, hasLocation: false, hasBody: true });
  const types = scenes.map((s) => s.type);
  assert.ok(!types.includes('time') && !types.includes('location'), 'time/location olmamalı');
  assert.ok(types.includes('date'), 'date olmalı');
  const { scenes: s2 } = buildScenes(20, { hasDate: false, hasTime: false, hasLocation: false, hasBody: false });
  const t2 = s2.map((s) => s.type);
  assert.ok(!t2.includes('message') && !t2.includes('date'), 'boş alanlar sahne üretmemeli');
  console.log('✓ buildScenes: koşullu sahneler');
}

/* ---------- 2) Yardımcılar ---------- */
const { estimateSeconds, wordsOf, fmtClock, clamp } = await mod('js/utils.js');

{
  assert.equal(wordsOf('merhaba dünya'), 2);
  assert.equal(wordsOf('   '), 0);
  assert.equal(estimateSeconds(0), 5, 'minimum 5 sn');
  assert.equal(estimateSeconds(72), 27, '72 kelime ≈ 27 sn (2.7 wps)');
  assert.equal(fmtClock(65.4), '1:05');
  assert.equal(fmtClock(28.45, true), '0:28.4');
  assert.equal(clamp(9, 0, 5), 5);
  console.log('✓ utils: kelime/süre tahmini, saat biçimi');
}

/* ---------- 3) Tasarım şablonları ---------- */
const { VIDEO_TEMPLATES, TEMPLATE_ORDER, MESSAGE_TEMPLATES, DEMO_FIELDS, DEFAULT_SETTINGS } = await mod('js/templates.js');

{
  assert.equal(TEMPLATE_ORDER.length, 5, '5 tasarım şablonu');
  assert.equal(TEMPLATE_ORDER[0], 'cinematic', 'varsayılan şablon Sinematik olmalı');
  for (const id of TEMPLATE_ORDER) {
    const t = VIDEO_TEMPLATES[id];
    for (const key of ['label', 'desc', 'bg', 'ink', 'accent', 'title', 'body', 'capsLabel', 'motion', 'decor']) {
      assert.ok(t[key] !== undefined, `${id}.${key} olmalı`);
    }
    assert.ok(t.title.font && t.title.size, `${id} title yazı tipi`);
    assert.ok(t.body.font && t.body.maxWidth, `${id} body ayarları`);
  }
  assert.ok(MESSAGE_TEMPLATES.length >= 4, 'en az 4 duyuru şablonu');
  assert.ok(MESSAGE_TEMPLATES.every((m) => m.fields && m.fields.body && m.fields.title), 'duyuru şablonları alanları');
  assert.ok(DEMO_FIELDS.title && DEMO_FIELDS.body, 'demo içerik tanımlı');
  assert.ok(DEFAULT_SETTINGS.ttsAuto === true, 'tts otomatik bulma varsayılan açık');
  console.log('✓ templates: Sinematik + 4 tasarım, 4 duyuru şablonu, demo içerik');
}

/* ---------- 4) Doğrulama mantığı ---------- */
const { validateBeforeExport, pickRecorderMime, isMp4Mime } = await mod('js/exporter.js');

{
  const noAudio = validateBeforeExport({ audio: null, sameCheck: true, fields: { body: 'test' } });
  assert.equal(noAudio.ok, false);
  assert.ok(noAudio.blocking.includes('no-audio'));

  const long = validateBeforeExport({
    audio: { duration: 42.1 }, sameCheck: true, fields: { body: 'test' },
  });
  assert.equal(long.ok, false, '42 sn engellenmeli');
  assert.ok(long.blocking.includes('too-long'));

  const unconfirmed = validateBeforeExport({
    audio: { duration: 28 }, sameCheck: false, fields: { body: 'test' },
  });
  assert.equal(unconfirmed.ok, false);

  const good = validateBeforeExport({
    audio: { duration: 28 }, sameCheck: true,
    fields: { body: 'Toplantı 25.09 saat 14:30\'da. Telefon: 0532 111 22 33', title: 'Veli Toplantısı' },
  });
  assert.equal(good.ok, true, 'geçerli durum');
  assert.ok(isMp4Mime('video/mp4'));
  assert.equal(isMp4Mime('video/webm;codecs=vp9'), false);
  console.log('✓ validateBeforeExport: 40 sn hard limit, onay, iletişim bilgisi');
  console.log('  recorder mime (node: MediaRecorder yok):', pickRecorderMime());
}

/* ---------- 5) TTS sağlayıcıları (frontend) ---------- */
const { BackendTTSProvider, BrowserSpeechProvider, TTS_SAMPLE_TEXT } = await mod('js/tts.js');

{
  assert.equal(typeof BrowserSpeechProvider.supported(), 'boolean');
  assert.ok(TTS_SAMPLE_TEXT.length > 10, 'örnek metin tanımlı');

  // BackendTTSProvider — fetch stub ile
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push([url, opts]);
    if (url.endsWith('/api/tts/voices')) {
      return {
        ok: true,
        json: async () => ({
          voices: [
            { id: 'edge:tr-TR-EmelNeural', provider: 'edge', name: 'Emel', gender: 'Kadın', lang: 'Türkçe', style: 'Doğal · Yapay zeka', offline: false },
            { id: 'piper:tr_TR-dfki-medium', provider: 'piper', name: 'tr_TR-dfki-medium', gender: 'Kadın', lang: 'Türkçe', style: 'Çevrimdışı', offline: true },
          ],
        }),
      };
    }
    if (url.endsWith('/api/tts')) {
      assert.equal(opts.method, 'POST');
      const body = JSON.parse(opts.body);
      assert.ok(body.text && body.voice, 'POST gövdesi metin+ses içermeli');
      return {
        ok: true,
        blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' }),
        headers: new Map([['X-Duration', '12.5'], ['X-Provider', 'edge']]),
      };
    }
    throw new Error('beklenmeyen url: ' + url);
  };

  const p = new BackendTTSProvider();
  const ok = await p.discover({ ttsUrl: '', ttsAuto: false, skipSameOrigin: true });
  // location.origin 'https://alpampa.github.io' adayına fetch gider ve hata fırlatır —
  // discover tüm adayları dener; biz ttsUrl vermedik ve auto kapalıysa yalnızca
  // location.origin kalır. O yüzden auto ile test edelim:
  const p2 = new BackendTTSProvider();
  const ok2 = await p2.discover({ ttsUrl: 'http://127.0.0.1:8765', ttsAuto: false });
  assert.equal(ok2, true, 'sunucu bulunmalı');
  assert.equal(p2.baseUrl, 'http://127.0.0.1:8765');

  const voices = await p2.getVoices();
  assert.equal(voices.length, 2, '2 ses gelmeli');
  assert.ok(voices[0].id.startsWith('edge:'), 'edge sesi');

  const gen = await p2.generate('Merhaba', voices[0].id);
  assert.ok(gen.blob instanceof Blob, 'wav blob dönmeli');
  assert.equal(gen.duration, 12.5, 'X-Duration başlığı okunmalı');
  assert.equal(gen.provider, 'edge');

  // başarısız durum
  globalThis.fetch = async () => ({ ok: false, status: 502, json: async () => ({ error: 'provider_failed' }) });
  await assert.rejects(
    () => p2.generate('x', 'edge:tr-TR-EmelNeural'),
    /provider_failed/,
    'sunucu hatası kullanıcıya ulaşmalı'
  );
  console.log('✓ tts: BackendTTSProvider keşif/voices/generate/başlık/hata + BrowserSpeech');
  void ok; void p;
}

/* ---------- 5b) Taslak deposu (bellek) ---------- */
const { createDraftStore } = await mod('js/drafts.js');

{
  const store = createDraftStore(); // node: indexedDB yok -> bellek yedeği
  const blob = new Blob(['fake-audio-bytes'], { type: 'audio/wav' });
  const id = await store.save({
    name: 'Toplantı taslağı',
    title: 'VELİ TOPLANTISI',
    fields: { title: 'VELİ TOPLANTISI', body: 'Toplantı yarın.' },
    templateId: 'school',
    sameCheck: true,
    audio: { kind: 'ai', name: 'Emel sesi', duration: 12.5, provider: 'edge', voice: 'edge:tr-TR-EmelNeural' },
    audioBlob: blob,
  });
  assert.ok(id, 'id dönmeli');
  const list = await store.list();
  assert.equal(list.length, 1, 'liste 1 kayıt');
  assert.equal(list[0].title, 'VELİ TOPLANTISI');
  const full = await store.get(id);
  assert.ok(full.audioBlob instanceof Blob, 'ses blobu saklanmalı');
  assert.equal(full.audio.voice, 'edge:tr-TR-EmelNeural', 'voice meta saklanmalı');
  assert.equal(full.templateId, 'school');
  await store.del(id);
  assert.equal((await store.list()).length, 0, 'silme çalışmalı');
  console.log('✓ drafts: kaydet/liste/oku/sil + blob + meta');
}

/* ---------- 5c) Paylaşım mantığı ---------- */
const { shareFilename, buildShareChecklist, systemShare, shareLinkText } = await mod('js/share.js');

{
  const fn = shareFilename('Veli Toplantısı', new Date('2026-08-22T10:00:00'));
  assert.equal(fn, 'veli-mesaji-veli-toplantısı-2026-08-22.mp4', 'dosya adı: ' + fn);
  const fn2 = shareFilename('', new Date('2026-08-22'));
  assert.ok(fn2.includes('mesaj-2026-08-22'), 'boş başlık yedeği: ' + fn2);

  const ok = buildShareChecklist({ duration: 28.4 });
  assert.equal(ok.shareable, true);
  assert.equal(ok.items.length, 5, '5 kontrol maddesi');
  assert.ok(ok.items[2].ok, '28.4 sn ok');
  const bad = buildShareChecklist({ duration: 42.7 });
  assert.equal(bad.shareable, false, '42.7 sn paylaşılabilir DEĞİL');
  assert.equal(bad.items[2].ok, false, 'süre maddesi ✗');

  // sistem paylaşımı yok -> fallback
  const navNo = { canShare: undefined, share: undefined };
  assert.equal(await systemShare(new Blob(['x']), 'a.mp4', 't', navNo), 'fallback');
  // canShare files desteklenmiyor -> fallback
  const navNoFiles = { canShare: () => false, share: () => {} };
  assert.equal(await systemShare(new Blob(['x']), 'a.mp4', 't', navNoFiles), 'fallback');
  // destekleniyor -> native
  const navYes = { canShare: () => true, share: async () => {} };
  assert.equal(await systemShare(new Blob(['x']), 'a.mp4', 't', navYes), 'native');

  assert.ok(shareLinkText('Toplantı', 'https://site').includes('Toplantı'));
  console.log('✓ share: dosya adı, 40 sn kontrolü, sistem paylaşımı fallback/native');
}

/* ---------- 6) DOM boot testi (jsdom) ---------- */
const { JSDOM, VirtualConsole } = await import('jsdom');

{
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    const raw = (e && e.detail) || e;
    const msg = String((raw && (raw.message || raw)) || '');
    // jsdom'da canvas yok — uygulama bu durumu güvenle yoksayıyor
    if (msg.includes('Not implemented: HTMLCanvasElement')) return;
    errors.push('jsdomError: ' + msg);
  });
  vc.on('error', (m) => errors.push('console.error: ' + m));

  const dom = new JSDOM(html, {
    url: 'https://alpampa.github.io/veli-mesaji/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const w = dom.window;

  // global ortamı kur
  for (const k of ['window', 'document', 'navigator', 'localStorage', 'location', 'customElements', 'HTMLElement', 'HTMLCanvasElement', 'Image']) {
    if (w[k] === undefined) continue;
    try {
      globalThis[k] = w[k];
    } catch {
      Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true });
    }
  }
  globalThis.confirm = () => true;
  globalThis.alert = () => {};
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.fetch = (url) => { throw new Error('fetch çağrılmamalı: ' + url); };

  await import(pathToFileURL(join(root, 'js/main.js')).href);

  const d = w.document;
  assert.equal(d.querySelectorAll('.tmpl-card').length, 5, '5 tasarım kartı');
  // TTS sunucusu yok -> kurulum durumu gösterilmeli (sahte ses kartı OLMAZ)
  assert.ok(d.querySelector('#ttsSetup') && !d.querySelector('#ttsSetup').classList.contains('hidden'), 'TTS kurulum durumu gösterilmeli');
  assert.equal(d.querySelectorAll('.voice-card').length, 0, 'sunucu yokken sahte ses kartı olmamalı');
  assert.equal(d.querySelectorAll('#readiness .ri').length, 3, '3 hazırlık maddesi');
  assert.ok(d.querySelector('#generateBtn').disabled, 'üretim butonu başlangıçta engelli');
  // demo önizleme çalışıyor (boş durum kapalı, demo notu görünür)
  assert.ok(d.querySelector('#stageEmpty').classList.contains('hidden'), 'demo açıkken boş durum gizli');
  assert.ok(/Demo/.test(d.querySelector('#tNote').textContent), 'demo notu görünmeli');

  // yazınca demo kapanır + tahmin güncellenir
  const body = d.querySelector('#body');
  body.value = 'Değerli velilerimiz, toplantımıza hepiniz davetlisiniz.';
  body.dispatchEvent(new w.Event('input', { bubbles: true }));
  const est = d.querySelector('#msgEstimate').textContent;
  assert.ok(/kelime ≈ \d+ sn/.test(est), 'kelime/süre tahmini: ' + est);
  assert.ok(!/Demo/.test(d.querySelector('#tNote').textContent), 'demo notu kalkmalı');
  assert.ok(d.querySelector('#stageEmpty').classList.contains('hidden'), 'içerik varken boş durum kapalı');

  // sekmeler çalışmalı
  const tabs = d.querySelectorAll('.tab');
  tabs[1].click();
  assert.ok(!d.querySelector('[data-tabbody="record"]').classList.contains('hidden'), 'Ses Kaydı sekmesi açılmalı');
  tabs[2].click();
  assert.ok(!d.querySelector('[data-tabbody="file"]').classList.contains('hidden'), 'Ses Dosyası sekmesi açılmalı');

  // şablon çipi doldurur
  const chip = d.querySelector('.chip-chip');
  chip.click();
  assert.ok(d.querySelector('#title').value, 'şablon başlık doldurmalı');

  // Temizle çalışır -> boş durum geri gelir
  w.confirm = () => true;
  d.querySelector('#clearBtn').click();
  assert.equal(d.querySelector('#title').value, '', 'temizle başlığı siler');
  assert.ok(!d.querySelector('#stageEmpty').classList.contains('hidden'), 'temizle sonrası boş durum görünür');
  assert.ok(d.querySelector('#generateBtn').disabled, 'temizle sonrası üretim engelli');

  // --- Taslak sistemi ---
  const titleInput = d.querySelector('#title');
  titleInput.value = 'VELİ TOPLANTISI';
  titleInput.dispatchEvent(new w.Event('input', { bubbles: true }));
  d.querySelector('#saveDraftBtn').click();
  assert.ok(!d.querySelector('#draftModal').classList.contains('hidden'), 'taslak modalı açılmalı');
  d.querySelector('#draftName').value = 'Test taslağı';
  d.querySelector('#draftSaveBtn').click();
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(d.querySelectorAll('.draft-row').length, 1, 'liste 1 taslak göstermeli');
  assert.equal(d.querySelector('#draftCount').textContent, '1', 'rozet sayacı 1');
  // formu boşalt
  titleInput.value = '';
  titleInput.dispatchEvent(new w.Event('input', { bubbles: true }));
  // aç: başlığı geri yükler ve modal kapanır
  d.querySelector('.draft-row [data-act="open"]').click();
  await new Promise((r) => setTimeout(r, 120));
  assert.ok(d.querySelector('#draftModal').classList.contains('hidden'), 'açınca modal kapanmalı');
  assert.equal(d.querySelector('#title').value, 'VELİ TOPLANTISI', 'açınca başlık geri gelmeli');
  // sil
  d.querySelector('#draftsBtn').click();
  await new Promise((r) => setTimeout(r, 40));
  d.querySelector('.draft-row [data-act="del"]').click();
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(d.querySelectorAll('.draft-row').length, 0, 'silince liste boşalmalı');
  d.querySelector('#draftClose').click();

  if (errors.length) {
    throw new Error('DOM boot hataları:\n' + errors.join('\n'));
  }
  console.log('✓ DOM boot: 5 tasarım + kurulum durumu + hazırlık + sekmeler + şablonlar + temizle + taslaklar');

  // arka plan zamanlayıcılarını kapat (test süreci sonlansın)
  const mainMod = await import(pathToFileURL(join(root, 'js/main.js')).href);
  if (typeof mainMod.__stopBackgroundTimers === 'function') mainMod.__stopBackgroundTimers();
}

/* ---------- 7) Render motoru duman testi (sahte canvas) ---------- */
const { StudioRenderer } = await mod('js/renderer.js');
const { VIDEO_TEMPLATES: VT, TEMPLATE_ORDER: TO, DEFAULT_FIELDS: DF } = await mod('js/templates.js');

{
  class MiniCtx {
    save() {} restore() {} clearRect() {} fillRect() {} beginPath() {} moveTo() {} lineTo() {}
    arc() {} arcTo() {} closePath() {} stroke() {} fill() {} translate() {} scale() {} drawImage() {}
    createLinearGradient() { return { addColorStop() {} }; }
    createRadialGradient() { return { addColorStop() {} }; }
    measureText(t) { return { width: String(t || '').length * 12 }; }
    fillText() {}
  }
  const fakeCanvas = { getContext: () => new MiniCtx() };
  const r = new StudioRenderer(fakeCanvas);
  assert.ok(r.ok, 'sahte canvas context verir');

  for (const id of TO) {
    r.setTemplate(VT[id]);
    r.setFields({
      school: 'Zeynep Kamil İlkokulu', title: 'VELİ TOPLANTISI',
      date: '25 EYLÜL', time: '14:30', location: 'Konferans Salonu',
      body: 'Değerli velilerimiz, toplantımıza hepiniz davetlisiniz.\nİkinci satır da gelsin.',
      sign: 'Sınıf Öğretmeni',
    });
    r.setLogo({}); // drawImage yolu
    const { scenes, videoDuration } = buildScenes(28, {
      hasDate: true, hasTime: true, hasLocation: true, hasBody: true,
    });
    r.setScenes({ scenes, videoDuration });
    const times = [0.001, ...scenes.map((s) => (s.start + s.end) / 2), videoDuration - 0.2, videoDuration + 0.2];
    for (const t of times) {
      assert.doesNotThrow(() => r.renderFrame(t), `renderFrame(${t}) — ${id}`);
    }
  }
  console.log('✓ renderer: 5 şablon × 7 sahne × zaman noktaları hatasız çiziyor');
}

console.log('\nTÜM TESTLER GEÇTİ ✅');
