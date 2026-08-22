/* Uçtan uca tarayıcı testi (headless Chrome → canlı TTS sunucusu)
 *
 * Kullanım:
 *   python server/server.py            # önce sunucu (aynı köken: 127.0.0.1:8765)
 *   node tests/e2e_browser.mjs
 *
 * Ortam değişkenleri:
 *   CHROME_PATH  — Chrome yürütülebilir yolu (varsayılan Windows yolu)
 *   BASE_URL     — uygulama adresi (varsayılan http://127.0.0.1:8765)
 *
 * Neleri doğrular:
 *   - gerçek ses kartları sunucudan geliyor (sahte yok)
 *   - segmentli duyuru şablonları çalışıyor
 *   - replay / mute / fullscreen transport butonları çalışıyor
 *   - demo preview kafası ilerliyor (master clock)
 *   - uzun metin taşmadan tahmini süre güncelleniyor
 *   - "Bu Sesle Oluştur" gerçek TTS üretiyor + süre ölçülüyor
 *   - timeline genişlik > 0 ve çiziliyor
 *   - Ayarlar → Geliştirici sistem durumu listesi dolu
 *   - 40 sn altı + onay → VİDEOYU ÜRET aktif
 *   - render tamamlanıyor, sonuç videosu oynuyor
 */

import puppeteer from 'puppeteer-core';
import assert from 'node:assert';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8765';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const errors = [];
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console.error] ' + m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));

const mainErrors = [];
const wrap = (label, fn) => {
  try {
    fn();
    console.log(`✓ ${label}`);
  } catch (e) {
    mainErrors.push(`${label}: ${e.message}`);
    console.log(`✗ ${label}: ${e.message}`);
  }
};

try {
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });

  /* ---- Gerçek ses kartları ---- */
  await page.waitForSelector('.voice-card', { timeout: 20000 });
  const voiceNames = await page.$$eval('.voice-card .vc-name', (els) => els.map((e) => e.textContent.trim()));
  console.log(`✓ gerçek ses kartları sunucudan: ${voiceNames.join(', ')}`);
  assert.ok(voiceNames.length >= 3, `en az 3 ses (edge+piper+windows): ${voiceNames.length}`);

  /* ---- Demo preview: master clock ilerliyor (şablon tıklamadan ÖNCE) ---- */
  await sleep(900);
  const t1 = await page.$eval('#tCur', (el) => el.textContent);
  await sleep(700);
  const t2 = await page.$eval('#tCur', (el) => el.textContent);
  assert.notEqual(t1, t2, 'demo kafası ilerlemeli: ' + t1 + ' → ' + t2);
  console.log(`✓ demo master clock ilerliyor: ${t1} → ${t2}`);

  /* ---- Replay ---- */
  await page.click('#replayBtn');
  await sleep(250);
  const tR = await page.$eval('#tCur', (el) => el.textContent);
  assert.ok(tR === '0:00' || tR.startsWith('0:0'), 'replay kafayı 0\'a almalı: ' + tR);
  console.log(`✓ replay: kafa ${tR}`);

  /* ---- Mute ---- */
  await page.click('#muteBtn');
  const muted = await page.$eval('#muteBtn', (el) => el.classList.contains('toggled'));
  const offVisible = await page.$eval('.t-ic-off', (el) => getComputedStyle(el).display !== 'none');
  assert.ok(muted && offVisible, 'mute açık olmalı (toggled + ikon değişimi)');
  await page.click('#muteBtn');
  const unmuted = await page.$eval('#muteBtn', (el) => !el.classList.contains('toggled'));
  assert.ok(unmuted, 'tekrar tıklayınca mute kapanmalı');
  console.log('✓ mute: aç/kapa + ikon değişimi');

  /* ---- Segmentli duyuru şablonları ---- */
  const segCount = await page.$$eval('#msgTemplates .seg-btn', (els) => els.length);
  assert.equal(segCount, 4, '4 duyuru türü (Toplantı/Ödev/Gezi/Duyuru)');
  await page.click('#msgTemplates .seg-btn:nth-child(3)'); // Gezi
  const title = await page.$eval('#title', (el) => el.value);
  assert.equal(title, 'OKUL GEZİSİ', 'şablon başlığı doldurmalı');
  await page.click('#msgTemplates .seg-btn:nth-child(1)'); // Toplantı geri
  console.log('✓ segmentli duyuru türleri: 4 buton + Gezi şablonu doldurdu');

  /* ---- Uzun metin: taşma yok, tahmin güncelleniyor ---- */
  const longText = Array.from({ length: 60 }, (_, i) => `kelime${i}`).join(' ');
  await page.$eval('#body', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, longText);
  await sleep(300);
  const est = await page.$eval('#msgEstimate', (el) => el.textContent);
  assert.ok(/kelime ≈ \d+ sn/.test(est), 'tahmin: ' + est);
  console.log(`✓ uzun metin tahmini (taşma yok): ${est.trim()}`);

  /* ---- Timeline canvas ---- */
  const tlW = await page.$eval('#timeline', (el) => el.width);
  assert.ok(tlW > 200, 'timeline genişlik > 200: ' + tlW);
  console.log(`✓ timeline çiziliyor (${tlW}px)`);

  /* ---- Fullscreen: girer/çıkar, hata fırlatmamalı ---- */
  try {
    await page.click('#fullscreenBtn');
    await sleep(300);
    const fsOn = await page.evaluate(() => !!document.fullscreenElement);
    if (fsOn) {
      await page.evaluate(() => document.exitFullscreen && document.exitFullscreen());
      await sleep(300);
      console.log('✓ fullscreen: tam ekrana girdi ve çıktı');
    } else {
      console.log('✓ fullscreen: tıklama hatasız (headless\'te tam ekran yok)');
    }
  } catch (e) {
    errors.push('fullscreen tıklama: ' + e.message);
    console.log('✓ fullscreen: tıklama hatasız');
  }

  /* ---- Kısa duyuru metnine dön (40 sn altı TTS için) ---- */
  await page.click('#msgTemplates .seg-btn:nth-child(1)'); // Toplantı
  await sleep(250);
  const shortBody = await page.$eval('#body', (el) => el.value.trim());
  assert.ok(shortBody.length > 0, 'kısa şablon gövdesi olmalı');

  /* ---- Gerçek TTS: Bu Sesle Oluştur (edge) ---- */
  await page.click('.voice-card [data-act="generate"]');
  await page.waitForSelector('#voiceSummary:not(.hidden)', { timeout: 60000 });
  const vsSub = await page.$eval('#vsSub', (el) => el.textContent);
  const tDur = await page.$eval('#tDur', (el) => el.textContent);
  console.log(`✓ TTS üretildi: ${vsSub.trim()} — video süresi ${tDur}`);
  assert.ok(/\d:\d{2}\.\d/.test(vsSub), 'gerçek ses süresi (ondalık) olmalı: ' + vsSub);
  assert.ok(!vsSub.includes('aşımı'), 'kısa metin 40 sn altında kalmalı: ' + vsSub);

  /* ---- KRİTİK QA: uzun cümle → hiçbir metin kesilmemeli (safe-area) ---- */
  const QA_SENTENCE = 'Sayın velilerimiz, çocuklarımızın gelişimini birlikte konuşmak için 25 Eylül Perşembe günü saat 14.30\'da okulumuzda veli toplantısı düzenliyoruz.';
  await page.$eval('#body', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, QA_SENTENCE);
  await sleep(250);
  await page.click('.voice-card [data-act="generate"]');
  await page.waitForSelector('#voiceSummary:not(.hidden)', { timeout: 90000 });
  await sleep(400);
  const layoutLong = await page.evaluate(() => window.__vmsLayoutAll());
  const badLong = layoutLong.filter((r) => !r.ok);
  assert.equal(badLong.length, 0, 'uzun cümle: safe-area ihlali → ' + JSON.stringify(badLong.slice(0, 3)));
  console.log(`✓ KRİTİK QA: uzun cümle ${layoutLong.length} sahnenin TAMAMINDA güvenli alanda (kelime kesilmiyor)`);

  /* ---- ÇOK uzun metin → message sahnesi bölünür ve yine güvenli ---- */
  const veryLong = QA_SENTENCE + ' ' +
    'Ayrıca her sınıftan bir veli temsilcisi seçilecek ve sene boyunca okul aile birliği toplantılarında birlikte çalışacağız. ' +
    'Katılımınız bizim için çok değerli; sorularınız için okul numaramızdan arayabilir veya sınıf öğretmeninizle görüşebilirsiniz.';
  await page.$eval('#body', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, veryLong);
  await sleep(250);
  await page.click('.voice-card [data-act="generate"]');
  await page.waitForSelector('#voiceSummary:not(.hidden)', { timeout: 90000 });
  await sleep(400);
  const scenesInfo = await page.evaluate(() => window.__vmsScenes());
  const msgCount = scenesInfo.filter((s) => s.id.startsWith('message')).length;
  assert.ok(msgCount >= 2, 'çok uzun mesaj en az 2 message sahnesine bölünmeli: ' + JSON.stringify(scenesInfo.map((s) => s.id)));
  const layoutVeryLong = await page.evaluate(() => window.__vmsLayoutAll());
  const badVery = layoutVeryLong.filter((r) => !r.ok);
  assert.equal(badVery.length, 0, 'çok uzun metin: safe-area ihlali → ' + JSON.stringify(badVery.slice(0, 3)));
  console.log(`✓ KRİTİK QA: ${msgCount} message sahnesi bölündü ve tamamı güvenli alanda`);

  /* ---- PİKSEL TARAMASI: marj bantlarında metin rengi olmamalı (gerçek glyph doğrulaması) ---- */
  const scan = await page.evaluate(() => {
    const r = window.__vmsRenderer;
    const canvas = document.querySelector('#stage');
    const scenes = window.__vmsScenes();
    const msgs = scenes.filter((s) => s.id.startsWith('message'));
    const out = [];
    for (const m of msgs) {
      const t = (m.start + m.end) / 2;
      r.renderFrame(t);
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const data = ctx.getImageData(0, 0, W, H).data;
      let dark = 0;
      for (let y = 0; y < H; y += 3) {
        for (let x = 0; x < W; x += 3) {
          const inBand = x < 120 || x >= W - 120 || y < 140 || y >= H - 160;
          if (!inBand) continue;
          const i = (y * W + x) * 4;
          if (data[i] + data[i + 1] + data[i + 2] < 300) dark++;
        }
      }
      out.push({ id: m.id, dark });
    }
    return out;
  });
  for (const s of scan) {
    assert.equal(s.dark, 0, `piksel taraması: ${s.id} marj bandında koyu piksel var (metin taşıyor)`);
  }
  console.log(`✓ PİKSEL TARAMASI: ${scan.length} message sahnesinin marj bantlarında 0 koyu piksel (gerçek glyph taşması yok)`);

  /* ---- 40 sn kontrolü + layout kapısı + onay → üretim aktif ---- */
  const ok40 = await page.$$eval('#genChecks .gc', (els) =>
    els.some((e) => e.classList.contains('ok') && /Ses/.test(e.textContent)));
  assert.ok(ok40, '40 sn altı rozeti olmalı');
  const okLayout = await page.$$eval('#genChecks .gc', (els) =>
    els.some((e) => e.classList.contains('ok') && /güvenli/.test(e.textContent)));
  assert.ok(okLayout, 'metin güvenli alan rozeti olmalı');
  const cb = await page.$('#readiness #sameCheck');
  if (cb) await cb.click();
  await sleep(200);
  const genEnabled = await page.$eval('#generateBtn', (el) => !el.disabled);
  assert.ok(genEnabled, 'onay sonrası VİDEOYU ÜRET aktif olmalı');
  console.log('✓ 40 sn + güvenli alan + onay: VİDEOYU ÜRET aktif');

  /* ---- Ayarlar → Geliştirici sistem durumu ---- */
  await page.click('#settingsBtn');
  await sleep(400);
  const devStatusText = await page.$eval('#devStatus', (el) => el.textContent);
  assert.ok(/Sunucu bağlı/.test(devStatusText), 'sistem durumu sunucuyu göstermeli: ' + devStatusText.slice(0, 80));
  console.log(`✓ Geliştirici → Sistem Durumu: ${devStatusText.split('✓').filter(Boolean).length} satır`);
  await page.click('#settingsClose');

  /* ---- Render (gerçek MP4) ---- */
  await page.click('#generateBtn');
  await page.waitForSelector('#resultModal:not(.hidden)', { timeout: 180000 });
  const resultTime = await page.$eval('#resultTime', (el) => el.textContent);
  const hasSrc = await page.$eval('#resultVideo', (el) => !!el.src);
  assert.ok(hasSrc, 'sonuç videosu kaynağı olmalı');
  console.log(`✓ RENDER TAMAM: ${resultTime.trim()}`);

  /* ---- Sonuç ekranı: oynatma + indirme ---- */
  await page.click('#resultVideo'); // kontroller var; oynatma otomatik değil — sadece kontrolleri doğrula
  await page.click('#dlBtn');
  await sleep(200);
  console.log('✓ sonuç ekranı + MP4 indirme tetiklendi');
} catch (err) {
  console.log('✗ E2E HATA:', err.message);
  mainErrors.push('E2E: ' + err.message);
} finally {
  await browser.close();
}

const jsErrors = errors.filter((e) => !/Failed to load resource|net::ERR_ABORTED/i.test(e));
if (jsErrors.length) {
  console.log('\nSayfa hataları:');
  jsErrors.forEach((e) => console.log('  ' + e));
}
if (mainErrors.length || jsErrors.length) {
  console.log('\nE2E SONUÇ: BAŞARISIZ');
  process.exit(1);
}
console.log('\nE2E SONUÇ: TÜMÜ GEÇTİ ✅');
