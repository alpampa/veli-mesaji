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
  const { scenes, videoDuration } = buildScenes(D, { hasDate: true, hasBody: true });
  assert.equal(scenes.length, 5, '5 sahne olmalı');
  assert.equal(scenes[0].type, 'intro');
  assert.equal(scenes[4].type, 'outro');
  const sum = scenes.reduce((a, s) => a + s.dur, 0);
  assert.ok(Math.abs(sum - videoDuration) < 0.001, 'süreler toplamı videoDuration olmalı');
  assert.ok(Math.abs(videoDuration - (D + 0.7)) < 0.001, `bitiş kuyruğu: ${videoDuration} ≈ ${D + 0.7}`);
  // ardışık olmalı
  scenes.forEach((s, i) => {
    if (i > 0) assert.ok(Math.abs(s.start - scenes[i - 1].end) < 0.001, 'sahneler ardışık olmalı');
  });
  // sahne arama
  const { sceneAt } = await mod('js/scenes.js');
  assert.equal(sceneAt(scenes, 0).type, 'intro');
  assert.equal(sceneAt(scenes, scenes[1].start).type, 'title');
  console.log('✓ buildScenes: 5 sahne, süre dağılımı, ardışıklık, sceneAt');
}

{
  // tarih/yer yoksa date sahnesi düşer
  const { scenes } = buildScenes(20, { hasDate: false, hasBody: true });
  assert.ok(!scenes.some((s) => s.type === 'date'), 'date sahnesi olmamalı');
  // mesaj yoksa message düşer
  const { scenes: s2 } = buildScenes(20, { hasDate: true, hasBody: false });
  assert.ok(!s2.some((s) => s.type === 'message'), 'message sahnesi olmamalı');
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
const { VIDEO_TEMPLATES, TEMPLATE_ORDER, MESSAGE_TEMPLATES } = await mod('js/templates.js');

{
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
  console.log('✓ templates: 5 tasarım + 4 duyuru şablonu tam');
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

/* ---------- 5) TTS sağlayıcı listesi ---------- */
const { AI_VOICES, BrowserSpeechProvider } = await mod('js/tts.js');

{
  assert.equal(AI_VOICES.length, 2);
  assert.ok(AI_VOICES[0].id.startsWith('tr_TR-'), 'Türkçe sesler');
  assert.equal(typeof BrowserSpeechProvider.supported(), 'boolean');
  console.log('✓ tts: 2 Türkçe ses tanımlı, provider arayüzü');
}

/* ---------- 6) DOM boot testi (jsdom) ---------- */
const { JSDOM, VirtualConsole } = await import('jsdom');

{
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    const msg = (e && (e.detail || e.message)) || '';
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
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.fetch = (url) => { throw new Error('fetch çağrılmamalı: ' + url); };

  await import(pathToFileURL(join(root, 'js/main.js')).href);

  const d = w.document;
  assert.equal(d.querySelectorAll('.tmpl-card').length, 5, '5 tasarım kartı');
  assert.equal(d.querySelectorAll('.voice-card').length, 2, '2 ses kartı');
  assert.equal(d.querySelectorAll('#readiness .ri').length, 3, '3 hazırlık maddesi');
  assert.ok(d.querySelector('#generateBtn').disabled, 'üretim butonu başlangıçta engelli');

  // yazınca tahmin güncellenmeli
  const body = d.querySelector('#body');
  body.value = 'Değerli velilerimiz, toplantımıza hepiniz davetlisiniz.';
  body.dispatchEvent(new w.Event('input', { bubbles: true }));
  const est = d.querySelector('#msgEstimate').textContent;
  assert.ok(/kelime ≈ \d+ sn/.test(est), 'kelime/süre tahmini: ' + est);

  // boş durum gizlenmeli
  assert.ok(d.querySelector('#stageEmpty').classList.contains('hidden'), 'boş durum kapanmalı');

  // sekmeler çalışmalı
  const tabs = d.querySelectorAll('.tab');
  tabs[1].click();
  assert.ok(!d.querySelector('[data-tabbody="record"]').classList.contains('hidden'), 'Kayıt sekmesi açılmalı');
  tabs[2].click();
  assert.ok(!d.querySelector('[data-tabbody="file"]').classList.contains('hidden'), 'Dosya sekmesi açılmalı');

  // şablon çipi doldurur
  const chip = d.querySelector('.chip-chip');
  chip.click();
  assert.ok(d.querySelector('#title').value, 'şablon başlık doldurmalı');

  if (errors.length) {
    throw new Error('DOM boot hataları:\n' + errors.join('\n'));
  }
  console.log('✓ DOM boot: 5 tasarım + 2 ses kartı + hazırlık + sekmeler + şablonlar');
}

/* ---------- 7) Render motoru duman testi (sahte canvas) ---------- */
const { StudioRenderer } = await mod('js/renderer.js');
const { VIDEO_TEMPLATES: VT, TEMPLATE_ORDER: TO, DEFAULT_FIELDS: DF } = await mod('js/templates.js');

{
  class MiniCtx {
    save() {} restore() {} clearRect() {} fillRect() {} beginPath() {} moveTo() {} lineTo() {}
    arc() {} arcTo() {} closePath() {} stroke() {} fill() {} translate() {} scale() {} drawImage() {}
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
    const { scenes, videoDuration } = buildScenes(28, { hasDate: true, hasBody: true });
    r.setScenes({ scenes, videoDuration });
    const times = [0.001, ...scenes.map((s) => (s.start + s.end) / 2), videoDuration - 0.2, videoDuration + 0.2];
    for (const t of times) {
      assert.doesNotThrow(() => r.renderFrame(t), `renderFrame(${t}) — ${id}`);
    }
  }
  console.log('✓ renderer: 5 şablon × tüm sahneler × zaman noktaları hatasız çiziyor');
}

console.log('\nTÜM TESTLER GEÇTİ ✅');
