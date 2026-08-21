/* Seslendirme sağlayıcıları
 *
 * TTSProvider arayüzü:
 *   generate(text, voiceId, onProgress) -> { blob, duration, url }
 *
 *  - PiperProvider   : piper-tts-web (WASM, tarayıcıda yerel çalışır, WAV üretir)
 *  - BrowserSpeechProvider : Web Speech API (yalnızca önizleme, dışa aktarılamaz)
 */

import { fetchWithProgress } from './utils.js';

export const AI_VOICES = [
  {
    id: 'tr_TR-dfki-medium',
    label: 'Elif',
    gender: 'Kadın',
    tag: 'Doğal · Kadın · Türkçe',
    desc: 'Yumuşak ve net bir okuma; veli mesajlarına uygun.',
    sizeMB: 63,
  },
  {
    id: 'tr_TR-fahrettin-medium',
    label: 'Murat',
    gender: 'Erkek',
    tag: 'Profesyonel · Erkek · Türkçe',
    desc: 'Duyurulara uygun, tok ve güvenilir bir ses.',
    sizeMB: 63,
  },
];

const BUNDLE_BASES = [
  'https://raw.githubusercontent.com/Poket-Jony/piper-tts-web/v1.1.2/dist/',
  'https://raw.githubusercontent.com/Poket-Jony/piper-tts-web/main/dist/',
];

const MODEL_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/';

function modelPathFor(voiceId) {
  const p = voiceId.split('-');
  return `${p[0].split('_')[0]}/${p.join('/')}/${p.join('-')}`;
}

/** Ses modelini HuggingFace'ten ilerleme bildirimiyle indirir */
class HFVoiceProvider {
  constructor(onProgress) {
    this.onProgress = onProgress;
    this.cache = new Map();
  }
  async fetch(voiceId) {
    if (this.cache.has(voiceId)) return this.cache.get(voiceId);
    const base = MODEL_BASE + modelPathFor(voiceId);
    const cfgRes = await fetch(base + '.onnx.json');
    if (!cfgRes.ok) throw new Error('Ses yapılandırması indirilemedi.');
    const cfg = await cfgRes.json();
    const modelBlob = await fetchWithProgress(base + '.onnx', (p) => this.onProgress && this.onProgress(p));
    const url = URL.createObjectURL(modelBlob);
    const result = [cfg, url];
    this.cache.set(voiceId, result);
    return result;
  }
  destroy() {
    this.cache.forEach(([, url]) => URL.revokeObjectURL(url));
    this.cache.clear();
  }
}

export class PiperProvider {
  constructor() {
    this.bundle = null;
    this.base = null;
    this.engine = null;
    this.voiceProvider = null;
    this._loading = null;
  }

  async loadBundle() {
    if (this.bundle) return this.bundle;
    if (this._loading) return this._loading;
    this._loading = (async () => {
      let lastErr = null;
      for (const base of BUNDLE_BASES) {
        try {
          const mod = await import(base + 'piper-tts-web.js');
          if (!mod.PiperWebWorkerEngine || !mod.OnnxWebWorkerRuntime || !mod.PhonemizeWebWorkerRuntime) {
            throw new Error('Kütüphane sürümü uyumsuz');
          }
          this.bundle = mod;
          this.base = base;
          return mod;
        } catch (err) {
          lastErr = err;
        }
      }
      throw new Error('Seslendirme motoru indirilemedi (' + (lastErr && lastErr.message ? lastErr.message : 'ağ hatası') + ').');
    })();
    return this._loading;
  }

  async getEngine(onStatus) {
    const mod = await this.loadBundle();
    if (this.engine) return this.engine;
    onStatus && onStatus('Seslendirme motoru hazırlanıyor…');
    this.voiceProvider = new HFVoiceProvider();
    const stub = { destroy() {} };
    this.engine = new mod.PiperWebWorkerEngine({
      onnxRuntime: new mod.OnnxWebWorkerRuntime({
        basePath: this.base + 'onnx/',
        numThreads: 1,
      }),
      phonemizeRuntime: new mod.PhonemizeWebWorkerRuntime({
        basePath: this.base + 'piper/',
      }),
      expressionRuntime: stub,
      voiceProvider: this.voiceProvider,
    });
    return this.engine;
  }

  /**
   * @param {string} text
   * @param {string} voiceId AI_VOICES id'si
   * @param {(p:number)=>void} onProgress model indirme ilerlemesi
   * @param {(msg:string)=>void} onStatus
   */
  async generate(text, voiceId, onProgress, onStatus) {
    const engine = await this.getEngine(onStatus);
    onStatus && onStatus('Ses modeli indiriliyor…');
    this.voiceProvider.onProgress = onProgress;
    onStatus && onStatus('Ses oluşturuluyor…');
    const response = await engine.generate(text, voiceId, 0);
    return {
      blob: response.file,
      duration: response.duration / 1000,
      url: URL.createObjectURL(response.file),
      sampleRate: 22050,
    };
  }

  destroy() {
    try {
      if (this.engine) this.engine.destroy();
    } catch { /* yok say */ }
    this.engine = null;
    if (this.voiceProvider) {
      this.voiceProvider.destroy();
      this.voiceProvider = null;
    }
  }
}

/** Hızlı "örnek dinle" ve Piper yüklenemezse yedek olarak Web Speech API */
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
