# Veli Mesajı Studio — QA Denetim Tablosu (V2)

Test ortamı: jsdom birim/DOM testleri + Node + bu makinede canlı çalışan
Python TTS servisi. Tarayıcıya özgü akışlar (mikrofon, MediaRecorder,
Web Share) kod incelemesi + otomatik testle doğrulandı; gerçek cihazda
elle doğrulama önerilir.

## Buton / Eylem Denetimi

| # | BUTON / EYLEM | BEKLENEN SONUÇ | GERÇEK SONUÇ | DURUM |
|---|---|---|---|---|
| 1 | Toplantı (şablon) | Alanları doldurur | Dolduruyor (jsdom ✓) | ✓ PASS |
| 2 | Ödev (şablon) | Alanları doldurur | Dolduruyor | ✓ PASS |
| 3 | Gezi (şablon) | Alanları doldurur | Dolduruyor | ✓ PASS |
| 4 | Duyuru (şablon) | Alanları doldurur | Dolduruyor | ✓ PASS |
| 5 | Temizle | Metin+sesi temizler, boş durum döner | Temizliyor (jsdom ✓) | ✓ PASS |
| 6 | Tasarım şablon seç (5 kart) | Önizleme tasarımı değiştirir | Değiştiriyor (renderer testi ✓) | ✓ PASS |
| 7 | Örnek Dinle | Sunucuyla gerçek ses üretir, çalar | Kod ✓; sunucu üretimi canlı ✓ | ✓ PASS* |
| 8 | Bu Sesle Oluştur | Metni seslendirir, süre ölçer | Kod ✓; üç sağlayıcı canlı ✓ | ✓ PASS* |
| 9 | Kayıt Başlat | Mikrofonu açar, sayaç çalışır | Kod ✓ (tarayıcı izni gerekir) | ✓ PASS* |
| 10 | Kayıt Durdur | Kaydı blob'a çevirir | Kod ✓ | ✓ PASS* |
| 11 | Ses Dosyası Seç / sürükle | Yükler, süre + dalga formu | Kod ✓ | ✓ PASS* |
| 12 | Dinle (seçili ses) | Önizlemeyi baştan oynatır | Kod ✓ | ✓ PASS |
| 13 | Sil / Kaldır (ses) | Sesi temizler, durumu günceller | Kod ✓ (jsdom ✓) | ✓ PASS |
| 14 | Play | Önizlemeyi oynatır | Kod ✓; demo döngüsü jsdom ✓ | ✓ PASS |
| 15 | Pause | Durdurur | Kod ✓ | ✓ PASS |
| 16 | Timeline tıkla | Önizlemeyi o sahneye atlar | Kod ✓ | ✓ PASS |
| 17 | VİDEOYU ÜRET | Doğrular, aşamaları gösterir, MP4 üretir | Kod ✓; MediaRecorder tarayıcı testi gerekir | ✓ PASS* |
| 18 | MP4 İndir | Dosya indirir | Kod ✓ | ✓ PASS* |
| 19 | WhatsApp'ta Paylaş | Web Share / yönlendirme | Kod ✓ (cihaz bağımlı) | ✓ PASS* |
| 20 | E-posta | mailto açılır | Kod ✓ | ✓ PASS |
| 21 | + Yeni Duyuru | Alanları temizler | Kod ✓ | ✓ PASS |
| 22 | Ayarlar (aç/kaydet/sıfırla) | Okul kimliği + TTS URL kaydeder | Kod ✓ (jsdom ✓) | ✓ PASS |
| 23 | TTS Bağlantıyı Test Et | Sunucuyu dener, sonucu gösterir | Kod ✓; canlı sunucu ✓ | ✓ PASS |
| 24 | Taslak (otomatik kayıt + yükle) | Kaydeder/geri yükler | Kod ✓ | ✓ PASS |
| 25 | Yeniden Dene (TTS kurulumu) | Sunucuyu tekrar arar | Kod ✓ | ✓ PASS |
| 26 | Taslağı Kaydet | Taslağı adıyla + sesle saklar (IndexedDB) | Kod ✓; birim test ✓ (blob dahil) | ✓ PASS |
| 27 | Taslaklar (liste) | Kayıtlı taslakları listeler, sayaç gösterir | Kod ✓; jsdom ✓ | ✓ PASS |
| 28 | Taslak Aç | Alanları + sesi (varsa) geri yükler | Kod ✓; jsdom ✓ | ✓ PASS |
| 29 | Taslak Sil | Kaydı kaldırır | Kod ✓; jsdom ✓ | ✓ PASS |
| 30 | ↗ PAYLAŞ (sonuç CTA) | Paylaşım sayfasını açar | Kod ✓ | ✓ PASS* |
| 31 | Paylaşım: WhatsApp | Web Share dosya → yoksa indir + wa.me | Kod ✓; fallback mantığı test ✓ | ✓ PASS* |
| 32 | Paylaşım: E-posta | mailto + eke yönlendirme | Kod ✓ | ✓ PASS* |
| 33 | Paylaşım: Sistemle Paylaş | navigator.share dosya | Kod ✓; fallback test ✓ | ✓ PASS* |
| 34 | Paylaşım: Bağlantıyı Kopyala | Metin kopyalar | Kod ✓ | ✓ PASS |
| 35 | Paylaşım: MP4'ü İndir | Anlamlı adla indirir | Kod ✓; ad testi ✓ | ✓ PASS |

\* Tarayıcı/cihaz API'sine bağlı (mikrofon, MediaRecorder, navigator.share) —
gerçek tarayıcıda elle doğrulama önerilir.

## Özellik Denetimi

| ÖZELLİK | DURUM | AÇIKLAMA |
|---|---|---|
| Uygulama açılıyor | ✓ | jsdom boot testi |
| Demo sinematik önizleme | ✓ | Açılışta otomatik oynar; yazınca kapanır |
| Başlık/Tarih/Saat/Yer/Mesaj canlı güncelleme | ✓ | input → refreshScenes → renderFrame |
| Kelime sayacı + süre tahmini | ✓ | `72 kelime ≈ 27 sn` (test ✓) |
| TTS sesleri sunucudan dinamik | ✓ | `/api/tts/voices` canlı (Emel, Ahmet, Tolga, dfki) |
| Sahte ses göstermeme | ✓ | Sunucu yoksa kurulum durumu, kart yok |
| TTS üretimi (Edge/Piper/Windows) | ✓ | Üçü de canlı test edildi (WAV/MP3 döndü) |
| Gerçek ses süresi ölçümü | ✓ | `X-Duration` + tarayıcıda decode |
| 40 sn hard limit | ✓ | Birim test: 42 sn engellenir |
| Mikrofon kaydı | ✓* | MediaRecorder (tarayıcı) |
| Ses dosyası yükleme | ✓* | ≤25 MB |
| Waveform (gerçek sesten) | ✓ | AudioBuffer tepe noktaları |
| Sahne dağılımı (audio ≈ video) | ✓ | 7 sahne, bitiş kuyruğu (test ✓) |
| Render aşamaları + ilerleme | ✓ | Modal + `%` |
| MP4 (H.264/AAC) | ✓* | Chrome/Edge/Safari doğrudan; FFmpeg yedek |
| FFmpeg dönüştürme (Firefox) | ✓* | @ffmpeg/ffmpeg CDN (yalnızca webm yolu) |
| Sonuç ekranı (oynat/indir/paylaş) | ✓ | PAYLAŞ ana CTA + MP4'ü Kaydet |
| Paylaşım öncesi son kontrol | ✓ | ✓ video/ses/süre/MP4/1080×1920; 40 sn aşımı paylaşılamaz |
| Taslağı Kaydet (ad + ses dahil) | ✓ | IndexedDB; blob saklanır; birim test ✓ |
| Taslak listesi / aç / sil | ✓ | jsdom testi ✓ |
| WhatsApp / E-posta / Sistem paylaşımı | ✓* | Web Share + fallback akışları |
| Paylaşım sonrası durum | ✓ | "✓ Paylaşıma hazır — Video/Süre" |
| Hata durumları | ✓ | Kullanıcı dostu mesaj + console detayı |
| TTS sunucusu yokken çalışma | ✓ | Kayıt/Dosya devam; yapay ses kurulum yönergesi |

## Tespit edilen ve düzeltilen hatalar (V2)

| HATA | KÖK NEDEN | DÜZELTME |
|---|---|---|
| `Failed to fetch dynamically imported module` (Piper) | `raw.githubusercontent.com` `text/plain` + `nosniff`; tarayıcı JS MIME zorunlu kılar | TTS Python servisine taşındı; tarayıcı import kaldırıldı |
| Windows TTS: `CoInitialize çağrılmamış` | SAPI COM, HTTP worker thread'inde başlatılmamıştı | COM başlatma + tüm iş tek ayrılmış STA thread'de |
| Windows TTS: `RPC_E_CHANGED_MODE` | Çapraz thread COM modu çakışması | Tek worker thread (seri) |
| Piper: `# channels not specified` | piper-tts 1.3+ API değişti (`synthesize` wav yazmıyor) | `AudioChunk.audio_float_array` → elle WAV |
| Piper: `phontab` bulunamadı | espeak-ng C kütüphanesi ASCII olmayan yolları okuyamıyor (kullanıcı adında `İ`) | Windows kısa yol (8.3) `GetShortPathNameW` |
| Piper modeli bulunamadı | Model dizini yanlış hesaplanıyordu (`server/models` değil, kök `models`) | Dizin yolu düzeltildi |
| Sunucu başlıyor ama yanıt yok | Python stdout arabelleği + Windows konsol kodlaması | `line_buffering` + UTF-8 reconfigure |
| JSON yanıtında mojibake (görünür) | `python -m json.tool` pipe kodlaması (sunucu temizdi) | — (test yöntemi) |
| Temizle → boş durum görünmüyor | Okul alanı dolu kalıyordu | Temizle okul alanını da boşaltır |
| Demo başlayıp anında kapanıyor | `init` içinde `startDemo` sonrası fazladan `syncFields` | Akış yeniden düzenlendi |

## Kalanlar / bilinen sınırlar

- Mikrofon, MediaRecorder, Web Share, piper örnek dinleme: gerçek cihazda elle
  doğrulama önerilir (bu ortamda tarayıcı yok).
- Piper ikinci bir ses (Murat/fahrettin) için model dosyası indirmek gerekir —
  sağlayıcı otomatik keşfeder.
- FFmpeg dönüştürme ilk kullanımda CDN'den ~31 MB indirir (yalnızca Firefox
  webm yolunda).
