# 💌 Veli Mesajı — Görsel + Ses + Hareket

Velilere iletilecek bir mesajı **tek dosyada** hazırlayan web uygulaması.

**Neden böyle bir araç?**
> Yazı okunmayabiliyor, ses dinleniyor. İkisi birlikte gönderilince ulaşma artıyor.

Bu araç metni (görsel), ses kaydını (ses) ve animasyonları (hareket) tek bir kartta
birleştirir. Çıktı, WhatsApp/Telegram üzerinden velilere gönderilebilen tek bir
HTML dosyasıdır.

## Özellikler

- **Görsel**: Okul adı, başlık, mesaj metni ve imza; animasyonlu, degrade kart üzerinde canlı önizleme
- **Ses**:
  - Mikrofonla kayıt (tarayıcıda, izin gerektirir) — **40 saniyenin altında** hedefli zamanlayıcı
  - MP3 / WAV / M4A / OGG dosyası yükleme
  - Kayıt yoksa bile "Sesli dinle" ile tarayıcı metni Türkçe okur (Speech Synthesis)
- **Hareket**: Değişen degrade arka plan, süzülen ışık lekeleri, harf harf başlık animasyonu, nabız atan oynat düğmesi, ses ekolayzeri
- **Kontrol listesi**: Ses 40 sn altında mı? Metin ve ses aynı bilgiyi veriyor mu? Tarih/iletişim bilgisi var mı?
- **Paylaşım**:
  - 📄 Tek HTML dosyası indir (görsel + ses gömülü + hareket) — açan herkes çalıştırır, internete gerek yok
  - 🔗 Metin bağlantısı kopyala (sadece metni taşır; ses ayrı gönderilir)
- **Hazır şablonlar**: Toplantı hatırlatması, ödev bilgilendirmesi, okul gezisi, genel duyuru

## Kullanım

1. Sayfayı açın (canlı: https://alpampa.github.io/veli-mesaji/)
2. Hazır şablondan başlayın ya da mesajı kendiniz yazın
3. Sesi kaydedin (≤ 40 sn) veya ses dosyası yükleyin
4. Kontrol listesini gözden geçirin
5. **"İndir"** düğmesiyle tek HTML dosyası alın ve velilere gönderin

## Yerel çalıştırma

Build gerektirmez; dosyaları doğrudan açabilirsiniz:

```sh
# veya basit bir sunucu ile:
python -m http.server 8000
# http://localhost:8000
```

Mikrofon kaydı `file://` altında da çalışır, ama güvenli bağlam
(https veya localhost) her tarayıcıda önerilir.

## Teknik

- Saf HTML + CSS + JavaScript (bağımlılık yok)
- Kayıt: `MediaRecorder` (tarayıcıya göre m4a/webm/ogg)
- Dışa aktarma: Ses `base64` olarak tek HTML dosyasının içine gömülür
- Yedek seslendirme: Web Speech API (`tr-TR`)

## Dosyalar

| Dosya | Açıklama |
| --- | --- |
| `index.html` | Arayüz (düzenleyici + canlı önizleme) |
| `styles.css` | Tasarım ve tüm animasyonlar |
| `app.js` | Kayıt, yükleme, önizleme, dışa aktarma mantığı |

## Lisans

İzinsiz kullanım, kopyalama ve paylaşım serbesttir. ❤️
