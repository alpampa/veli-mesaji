/* Seslendirme sağlayıcıları (frontend tarafı)
 *
 * TTS üretimi artık TARAYICIDA YAPILMAZ. Metin, yerel/uzak Python servisine
 * gönderilir (server/server.py) ve WAV olarak geri döner. Böylece:
 *   - 46 MB'lık tarayıcı TTS motoru (piper-tts-web) hiç indirilmez
 *   - ses modeli tarayıcıya inmez; sunucu makinesinde kalır
 *   - provider mimarisi sunucuda (edge / piper / windows) işler
 *
 * Frontend sağlayıcıları:
 *   BackendTTSProvider   — sunucudan ses listesi + üretim
 *   BrowserSpeechProvider— yalnızca "hızlı örnek dinleme" için (dışa aktarılamaz)
 */

export const TTS_SAMPLE_TEXT =
  'Merhaba! Bu, veli mesajınızda kullanabileceğiniz örnek bir seslendirmedir.';

export const TTS_AUTO_URL = 'http://127.0.0.1:8765';
export const TTS_LOCALHOST_URL = 'http://localhost:8765';

export class BackendTTSProvider {
  constructor() {
    this.baseUrl = null;
    this.status = 'idle'; // idle | probing | ok | failed
    this.error = null;
    this.lastVoices = [];
    this.apiKey = ''; // opsiyonel X-API-Key (kullanıcı ayarlardan girer; JS'e gömülmez)
  }

  _headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    if (this.apiKey) h['X-API-Key'] = this.apiKey;
    return h;
  }

  setApiKey(key) {
    this.apiKey = (key || '').trim();
  }

  /**
   * Sunucuyu bulur: önce Ayarlar'daki URL, sonra 127.0.0.1:8765 ve
   * localhost:8765, en son da aynı köken (siteyi sunucu servis ediyorsa).
   * Her adayın sonucu diagnostics'te tutulur (kurulum ekranı için).
   */
  async discover({ ttsUrl = '', ttsAuto = true } = {}) {
    this.status = 'probing';
    this.error = null;
    this.diagnostics = [];
    const candidates = [];
    if (ttsUrl && ttsUrl.trim()) candidates.push(ttsUrl.trim().replace(/\/+$/, ''));
    if (ttsAuto) candidates.push(TTS_AUTO_URL, TTS_LOCALHOST_URL);
    if (typeof location !== 'undefined' && location.protocol.startsWith('http')) candidates.push(location.origin);

    const seen = new Set();
    for (const url of candidates) {
      if (seen.has(url)) continue;
      seen.add(url);
      try {
        const res = await fetch(url + '/api/tts/voices', {
          signal: AbortSignal.timeout(2500),
          headers: this.apiKey ? { 'X-API-Key': this.apiKey } : undefined,
        });
        if (res.ok) {
          const data = await res.json();
          this.baseUrl = url;
          this.lastVoices = Array.isArray(data.voices) ? data.voices : [];
          this.status = 'ok';
          return true;
        }
        this.diagnostics.push(`${url} → HTTP ${res.status}`);
      } catch (err) {
        this.diagnostics.push(`${url} → ${err && err.name ? err.name : 'hata'}`);
      }
    }
    this.status = 'failed';
    this.baseUrl = null;
    this.lastVoices = [];
    this.error = 'TTS sunucusuna ulaşılamadı.';
    return false;
  }

  async getVoices() {
    if (!this.baseUrl) return [];
    const res = await fetch(this.baseUrl + '/api/tts/voices');
    if (!res.ok) throw new Error('Ses listesi alınamadı');
    const data = await res.json();
    this.lastVoices = Array.isArray(data.voices) ? data.voices : [];
    return this.lastVoices;
  }

  /**
   * @returns {Promise<{blob:Blob, duration:number, provider:string, words:Array, sentences:Array, timing:string|null}>}
   */
  async generate(text, voiceId, onProgress) {
    if (!this.baseUrl) throw new Error('TTS sunucusu bağlı değil.');
    onProgress && onProgress(0.15);
    const res = await fetch(this.baseUrl + '/api/tts', {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ text, voice: voiceId }),
    });
    if (!res.ok) {
      let msg = `TTS hatası (${res.status})`;
      try {
        const err = await res.json();
        if (err && err.error) msg = err.error;
      } catch { /* yok say */ }
      throw new Error(msg);
    }
    const data = await res.json();
    onProgress && onProgress(1);
    if (!data.wavBase64) throw new Error('Sunucu ses verisi döndürmedi.');
    const binary = atob(data.wavBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: data.contentType || 'audio/wav' });
    return {
      blob,
      duration: data.duration ?? null,
      provider: data.provider || 'backend',
      words: Array.isArray(data.words) ? data.words : [],
      sentences: Array.isArray(data.sentences) ? data.sentences : [],
      timing: data.timing || null,
    };
  }
}

/** Hızlı "örnek dinle" ve sunucu yokken yedek olarak Web Speech API */
export class BrowserSpeechProvider {
  static supported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && !!window.speechSynthesis;
  }
  speak(text, { onEnd } = {}) {
    if (!BrowserSpeechProvider.supported()) return false;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'tr-TR';
    u.rate = 0.98;
    const voices = speechSynthesis.getVoices();
    const tr = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('tr'));
    if (tr) u.voice = tr;
    if (onEnd) {
      u.onend = () => onEnd();
      u.onerror = () => onEnd();
    }
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    return true;
  }
  stop() {
    if (BrowserSpeechProvider.supported()) speechSynthesis.cancel();
  }
}

/** Provider bilgisi için kısa etiket (görsel rozetler) */
export const PROVIDER_META = {
  edge: { badge: 'Edge-TTS', note: 'İnternet gerekir', cls: 'edge' },
  piper: { badge: 'Piper', note: 'Çevrimdışı · Yerel', cls: 'piper' },
  windows: { badge: 'Windows', note: 'Sistem sesi', cls: 'windows' },
};
