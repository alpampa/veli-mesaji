# 🎬 Veli Mesajı Studio — Cinematic Vertical Video Studio

**Metninizi profesyonel, sesli ve hareketli bir 9:16 videoya dönüştürün.**

> Yazı okunmayabiliyor, ses dinleniyor. İkisi birlikte gönderilince ulaşma artıyor.

**Canlı:** https://alpampa.github.io/veli-mesaji/

---

## Akış

```
Metni yaz → sesi seç (AI / kayıt / dosya) → tasarımı seç
   → sinematik önizlemede izle → timeline'da sahneleri gör
   → VİDEOYU ÜRET → 1080×1920 H.264 MP4 → WhatsApp / e-posta / indir
```

## TTS mimarisi (V2 — kök neden çözüldü)

Eski sürüm TTS'i tarayıcıya 46 MB'lık bir motoru `raw.githubusercontent.com`'dan
import ederek indiriyordu. Bu iki nedenden **asla çalışmazdı**:

1. `raw.githubusercontent.com` `.js` dosyalarını `Content-Type: text/plain` +
   `X-Content-Type-Options: nosniff` ile döndürür; tarayıcı ES modül import'unda
   JavaScript MIME'ı zorunlu tutar → `Failed to fetch dynamically imported module`.
2. 46 MB'lık motor + ~60 MB model indirmek tarayıcıya yük bindirirdi.

**Yeni mimari:** TTS üretimi tarayıcıda değil, yerel **Python servisinde** yapılır.

```text
Tarayıcı (ön yüz)
   ↓ POST /api/tts
Python TTS servisi (server/server.py — yalnızca stdlib)
   ↓ provider zinciri
tts/base.py  tts/edge_provider.py  tts/piper_provider.py  tts/windows_provider.py
```

### Sağlayıcılar (hepsi gerçek, hepsi test edildi ✓)

| Sağlayıcı | Sesler | İnternet | Not |
| --- | --- | --- | --- |
| **Edge-TTS** | Emel (Kadın), Ahmet (Erkek) | gerekir | Doğal yapay zeka sesleri |
| **Piper** | `models/piper/tr/*.onnx` (ör. tr_TR-dfki-medium) | **gerekmez** | Tamamen yerel/çevrimdışı |
| **Windows** | Sistem SAPI5 sesleri (ör. Tolga) | **gerekmez** | Yalnızca Windows |

Ses listesi `/api/tts/voices`'tan **dinamik** gelir; UI sahte ses göstermez.
Model tarayıcıya inmez; Piper modeli sunucu makinesinde `models/piper/tr/`
altında durur.

### Sunucuyu başlatma

```sh
pip install -r server/requirements.txt        # edge-tts, piper-tts, pyttsx3
python server/server.py                       # http://127.0.0.1:8765
```

Ön yüz, sunucuyu **otomatik bulur** (127.0.0.1:8765 → aynı köken → Ayarlar'daki
URL). Sunucu yoksa arayüz kurulum yönergesi gösterir; **Ses Kaydı ve Ses Dosyası
her zaman çalışır.**

### Çevrimdışı Piper modeli

```sh
mkdir -p models/piper/tr
curl -L -o models/piper/tr/tr_TR-dfki-medium.onnx \
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/tr/tr_TR/dfki/medium/tr_TR-dfki-medium.onnx"
curl -L -o models/piper/tr/tr_TR-dfki-medium.onnx.json \
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/tr/tr_TR/dfki/medium/tr_TR-dfki-medium.onnx.json"
```

Aynı klasöre `.onnx` + `.onnx.json` çifti eklerseniz ses galerisinde otomatik
görünür (ör. `tr_TR-fahrettin-medium` → erkek ses).

## Özellikler

### Sinematik önizleme (ürünün kalbi)
- Açılışta **otomatik oynayan demo sahne**: dağ siluetleri, ışık huzmesi, sis,
  vinyet — prosedürel çizilir, harici görsele bağımlı değil
- 7 sahne: `INTRO → TITLE → DATE → TIME → PLACE → MESSAGE → OUTRO`
  (boş alanlar sahne üretmez)
- Sahne animasyonları: fade-scale, slide-up, soft-reveal, line-reveal, fade-out
- **Önizleme ve MP4 aynı render motorunu kullanır** (WYSIWYG)

### 5 tasarım şablonu
**Sinematik** (geniş atmosfer) · **Okul** (kurumsal) · **Etkinlik** ·
**Sıcak** (veli iletişimi) · **Acil** — her biri kendi renk/tipografi/hareket diliyle.

### Timeline + dalga formu
- Gerçek ses dosyasından üretilen **waveform**
- Sahne segmentleri, zaman cetveli, oynatma kafası; sahneye tıklayınca atlama

### 40 saniye kuralı (hard limit)
- Yazarken `72 kelime ≈ 27 sn` tahmini; üretimde gerçek `00:31.4`
- 40 sn aşılırsa üretim engellenir

### Dışa aktarma
- **1080×1920 · 9:16 · H.264 + AAC · MP4**
- Chrome/Edge/Safari: `MediaRecorder` doğrudan MP4; Firefox: webm → **FFmpeg
  (WASM)** dönüştürme
- Aşamalı render ekranı; sonuçta **↗ PAYLAŞ** (ana CTA) + **⬇ MP4'ü Kaydet**

### Kaydetme
- **Taslağı Kaydet** — okul, başlık, mesaj, tarih/saat/yer, imza, şablon,
  sahne tanımları, ses meta bilgisi (provider + ses) ve **ses dosyası**
  IndexedDB'de saklanır; istediğiniz zaman geri açılır (adlı taslak listesi,
  silme, sayaç)
- Oturum taslağı otomatik kaydedilir (sayfa yenilenince geri gelir)

### Paylaşım sayfası
- **WhatsApp** (Web Share dosya → yoksa otomatik indir + wa.me), **E-posta**
  (konu + mesaj + ek yönlendirmesi), **↗ Sistemle Paylaş** (navigator.share),
  **🔗 Bağlantıyı Kopyala**, **⬇ MP4'ü İndir**
- Açılmadan önce son kontrol: ✓ video / ✓ ses / ✓ süre / ✓ MP4 / ✓ 1080×1920;
  40 sn aşımı **paylaşılabilir işaretlenmez**
- Başarılı paylaşım sonrası "✓ Paylaşıma hazır — Video · Süre" durumu

## Proje yapısı

```
index.html / styles.css       arayüz (Content | Preview+Timeline | Voice)
js/main.js                    durum, paneller, demo, üretim akışı
js/renderer.js                1080×1920 sahne çizim motoru (sinematik arka planlar)
js/scenes.js                  sahne dağıtımı (ses süresine göre)
js/audio.js                   AudioEngine — decode, oynatma, dalga formu
js/tts.js                     BackendTTSProvider + BrowserSpeechProvider
js/exporter.js                doğrulama + MediaRecorder MP4 + FFmpeg yedek
js/drafts.js                  taslak deposu (IndexedDB + bellek yedeği, ses dahil)
js/share.js                   paylaşım sayfası + yardımcılar
js/templates.js               video tasarım + duyuru şablonları + demo içerik
server/server.py              TTS mikro servisi (stdlib, CORS açık, statik ön yüz)
server/tts/*.py               provider mimarisi (edge / piper / windows)
tests/                        npm test + python tests/server_test.py
docs/QA.md                    buton/özellik denetim tablosu
```

## Testler

```sh
npm test                       # sahne/doğrulama/tasarım + DOM + render motoru
python tests/server_test.py    # servis mantığı + wav süresi
```

Canlı sunucu doğrulamaları (bu makinede yapıldı): Edge-TTS ✓, Piper ✓,
Windows SAPI ✓ — üçü de gerçek ses üretti.

## Yerel çalıştırma

```sh
npm install          # yalnızca geliştirme testleri için
npm run serve        # python -m http.server 8000  → http://localhost:8000
# TTS için ayrıca:
python server/server.py        # http://127.0.0.1:8765 (ön yüzü de sunar)
```

Mikrofon ve video kaydı güvenli bağlam ister (https veya localhost).

## Lisans

Serbest kullanım. ❤️
