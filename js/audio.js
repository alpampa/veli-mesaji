/* Ses motoru: decode, çalma, arama (seek), dalga biçimi tepe noktaları */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffer = null;
    this.source = null;
    this._offset = 0;
    this._startTime = 0;
    this._playing = false;
    this._onEnd = null;
    this._sink = null;
    this.analyser = null;
    this._analyserData = null;
    this._gain = null;   // hoparlör kazancı — sessize alma (dışa aktarma bundan etkilenmez)
    this._muted = false;
  }

  async init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Tarayıcınız ses çalmayı desteklemiyor.');
      this.ctx = new AC();
      this._gain = this.ctx.createGain();
      this._gain.gain.value = this._muted ? 0 : 1;
      this._gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  setMuted(m) {
    this._muted = !!m;
    if (this._gain && this.ctx) {
      this._gain.gain.setTargetAtTime(this._muted ? 0 : 1, this.ctx.currentTime, 0.02);
    }
  }

  get muted() {
    return this._muted;
  }

  toggleMuted() {
    this.setMuted(!this._muted);
    return this._muted;
  }

  async setBufferFromBlob(blob) {
    await this.init();
    const buf = await blob.arrayBuffer();
    this.buffer = await this.ctx.decodeAudioData(buf);
    return this.buffer;
  }

  setBuffer(buffer) {
    this.buffer = buffer;
  }

  get duration() {
    return this.buffer ? this.buffer.duration : 0;
  }

  get playing() {
    return this._playing;
  }

  get currentTime() {
    if (!this._playing || !this.ctx) return this._offset;
    return this._offset + Math.max(0, this.ctx.currentTime - this._startTime);
  }

  /**
   * Ses çalar. sink verilirse yalnızca o düğüme bağlanır (dışa aktarma için),
   * verilmezse hoparlöre.
   */
  /** Ses seviyesi tepkisi için analizör (audio-reactive motion) */
  startAnalyser() {
    if (!this.ctx || this.analyser) return;
    const a = this.ctx.createAnalyser();
    a.fftSize = 256;
    a.smoothingTimeConstant = 0.6;
    this.analyser = a;
    this._analyserData = new Uint8Array(a.frequencyBinCount);
  }

  /** 0..1 arası sakinleştirilmiş seviye (orta band) */
  getLevel() {
    if (!this.analyser || !this._analyserData) return 0;
    this.analyser.getByteFrequencyData(this._analyserData);
    let sum = 0;
    for (let i = 2; i < 26; i++) sum += this._analyserData[i];
    return Math.min(1, (sum / (24 * 255)) * 2.6);
  }

  play({ offset = 0, sink = null, onEnd = null } = {}) {
    this.stop();
    if (!this.buffer || !this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    if (this.analyser) {
      src.connect(this.analyser);
      this.analyser.connect(sink || this._gain || this.ctx.destination);
    } else {
      src.connect(sink || this._gain || this.ctx.destination);
    }
    const startAt = this.ctx.currentTime;
    src.start(startAt, Math.min(offset, this.buffer.duration));
    this.source = src;
    this._startTime = startAt;
    this._offset = offset;
    this._playing = true;
    this._onEnd = onEnd;
    src.onended = () => {
      if (this.source === src) {
        this._playing = false;
        this._offset = Math.min(this.buffer ? this.buffer.duration : this._offset, this.currentTime);
        if (this._onEnd) this._onEnd();
      }
    };
  }

  pause() {
    if (this.source && this._playing) {
      this._offset = this.currentTime;
      try { this.source.stop(); } catch { /* yok say */ }
      this._playing = false;
    }
  }

  stop() {
    if (this.source) {
      try { this.source.stop(); } catch { /* yok say */ }
      this.source = null;
      this._playing = false;
    }
  }

  async decodePeaks(buckets = 720) {
    if (!this.buffer) return null;
    const data = this.buffer.getChannelData(0);
    const b = Math.min(buckets, data.length);
    const peaks = new Float32Array(b);
    const step = Math.floor(data.length / b);
    for (let i = 0; i < b; i++) {
      let sum = 0;
      let max = 0;
      const start = i * step;
      const end = Math.min(data.length, start + step);
      for (let j = start; j < end; j++) {
        const v = Math.abs(data[j]);
        sum += v * v;
        if (v > max) max = v;
      }
      peaks[i] = Math.max(Math.sqrt(sum / (end - start)), max * 0.25);
    }
    // normalize
    let peak = 0;
    for (let i = 0; i < b; i++) if (peaks[i] > peak) peak = peaks[i];
    if (peak > 0) for (let i = 0; i < b; i++) peaks[i] = Math.min(1, peaks[i] / peak);
    return peaks;
  }

  createCaptureSink() {
    return this.ctx.createMediaStreamDestination();
  }
}
