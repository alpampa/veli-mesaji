# 🎬 Veli Mesajı Studio

**Metninizi profesyonel, sesli ve hareketli bir 9:16 videoya dönüştürün.**

> Yazı okunmayabiliyor, ses dinleniyor. İkisi birlikte gönderilince ulaşma artıyor.

Veli Mesajı Studio, velilere gönderilecek bir duyuruyu **tek tıkla 1080×1920 MP4
videoya** çevirir: metin (görsel) + seslendirme (ses) + animasyonlar (hareket).
Çıktı WhatsApp/Telegram/e-posta ile doğrudan paylaşılabilir.

**Canlı:** https://alpampa.github.io/veli-mesaji/

---

## Akış

```
Metni yaz → sesi seç → tasarımı seç → önizlemede izle
     → timeline'da sahneleri gör → VİDEOYU ÜRET → MP4 → Paylaş
```

## Özellikler

### Sahne tabanlı video motoru
- Sahneler: `INTRO → TITLE → DATE → MESSAGE → OUTRO`
- Sahne süreleri **ses süresine göre otomatik dağıtılır** (`audio ≈ video`)
- 5 tasarım şablonu: **Sade · Okul · Etkinlik · Sıcak · Acil**
  (her biri kendi renk sistemi, tipografi, yerleşim ve animasyon diliyle)
- Animasyonlar: fade, slide-up/left, scale, satır satır metin açılımı, vurgu çizgisi çizimi, logo girişi — hepsi yumuşak ve profesyonel
- Önizleme ve MP4 çıktısı **aynı render motorunu** kullanır (WYSIWYG)

### Seslendirme (sağ panel — 3 yol)
1. **Yapay Ses** — 2 doğal Türkçe ses:
   - **Elif** (♀) — `tr_TR-dfki-medium` (Piper, WASM)
   - **Murat** (♂) — `tr_TR-fahrettin-medium`
   - Piper tarayıcıda **yerel** çalışır: metin cihazdan çıkmaz, anahtar gerekmez
   - İlk kullanımda ses modeli bir kez indirilir (~60 MB), sonra tarayıcıda kalır
   - Hızlı "Örnek Dinle" için Web Speech API yedeği
2. **Kayıt** — mikrofonla kendi sesiniz (40 sn hedefli zamanlayıcı)
3. **Dosya** — MP3 / WAV / M4A / OGG yükleme

TTS mimarisi **provider tabanlıdır** (`js/tts.js`): `PiperProvider` ve
`BrowserSpeechProvider`; ileride yeni motorlar eklenebilir.

### Timeline + waveform
- Ses süresine ölçekli **dalga formu**
- Sahne segmentleri + oynatma kafası + zaman cetveli
- Sahneye tıklayın → önizleme oraya atlar

### 40 saniye kuralı (hard limit)
- Yazarken canlı tahmin: `72 kelime ≈ 27 sn`
- Ses üretilince gerçek süre: `00:28.4`
- 40 sn aşılınca üretim **engellenir** ve düşündürücü bir uyarı gösterilir

### Dışa aktarma
- **1080×1920 · 9:16 · H.264 + AAC · MP4**
- Chrome/Edge/Safari: `MediaRecorder` ile doğrudan MP4
- Firefox: webm → **FFmpeg (WASM)** ile MP4'e dönüştürme
- Aşamalı render ekranı (kontrol → ses → süre → sahneler → render)
- Sonuç: oynat, indir, WhatsApp (Web Share API, yoksa yönlendirme), e-posta

### Diğer
- Canlı önizleme: metin değişince video anında güncellenir
- Okul kimliği ayarları (ad, telefon, adres, logo) — tarayıcıda saklanır
- Taslak otomatik kaydı + geri yükleme
- Duyuru şablonları: toplantı, ödev, gezi, duyuru
- Üretim öncesi hazırlık listesi (ses ≤ 40 sn, metin↔ses onayı, iletişim bilgisi)
- Boş durum, hata tasarımı, mikro etkileşimler

## Yerel çalıştırma

```sh
npm install        # yalnızca geliştirme testleri için (jsdom)
npm test           # birim + DOM testleri
npm run serve      # python -m http.server 8000 → http://localhost:8000
```

Mikrofon ve video kaydı **güvenli bağlam** ister (https veya localhost).

## Mimari

```
index.html            arayüz (Content | Preview+Timeline | Voice)
styles.css            tasarım sistemi (token'lar + mikro etkileşimler)
js/main.js            durum, panel bağlama, üretim akışı, taslak
js/renderer.js        StudioRenderer — 1080×1920 sahne çizim motoru
js/scenes.js          sahne dağıtımı (ses süresine göre)
js/audio.js           AudioEngine — decode, oynatma, arama, tepe noktaları
js/tts.js             TTSProvider'lar (Piper WASM + Web Speech)
js/exporter.js        doğrulama + MediaRecorder MP4 + FFmpeg yedek
js/templates.js       video tasarım + duyuru şablonları
js/utils.js           yardımcılar
tests/run.mjs         testler (npm test)
```

### Dış kaynaklar (çalışma zamanında yüklenir)
- TTS motoru: `piper-tts-web` v1.1.2 (raw.githubusercontent, sabit sürüm)
- Ses modelleri: `rhasspy/piper-voices` v1.0.0 (HuggingFace, CORS açık)
- FFmpeg (yalnızca Firefox yolu): `@ffmpeg/ffmpeg` + `@ffmpeg/core` (unpkg)
- Yazı tipleri: Space Grotesk + Inter (Google Fonts, `latin-ext`)

## Testler

`npm test` şunları doğrular: sahne dağılımı matematiği, 40 sn hard limit ve
doğrulama mantığı, tasarım şablon bütünlüğü, DOM arayüz başlatma (jsdom),
render motorunun tüm şablon/sahne/zaman noktalarında hatasız çizimi.

## Lisans

Serbest kullanım. ❤️
