/* StudioRenderer — 1080×1920 canvas üzerinde hem canlı önizlemeyi hem
 * dışa aktarımı besleyen tek render motoru (WYSIWYG).
 *
 * Zamanlama: MASTER TIMELINE'a bağlıdır (js/timeline.js). Sahne sınırları ve
 * mesaj satırları gerçek TTS kelime zamanlamalarından gelir; çizim her karede
 * global t üzerinden yapılır → preview ile final MP4 birebir aynıdır.
 *
 * METİN ASLA KIRPILMAZ:
 *   - Tüm metin blokları js/textfit.js fitBlock ile güvenli alana sığdırılır
 *     (sol 120 · sağ 120 · üst 140 · alt 160)
 *   - maskedLine'ın klip kutusu inme (descent) dahil tam glif kutusunu kaplar
 *   - Kamera hareketi yalnızca DEKOR katmanına uygulanır; metin geometrisi
 *     sabittir → parallax hissi korunur, kırpma imkânsız olur
 *   - entrance hareketi kutuya göre safe-area ile sınırlanır
 *   - checkSafeArea(t) her sahnenin gerçek kutusunu doğrular (QA kapısı)
 */

import {
  clamp, clamp01, easeOutCubic, easeInOutCubic,
} from './utils.js';
import { sceneAt } from './timeline.js';
import {
  SAFE, VIDEO_W as W, VIDEO_H as H,
  fitBlock, blockBox, withinSafe, wrapLinesStrict, measureWidth,
} from './textfit.js';

export class StudioRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.template = null;
    this.fields = null;
    this.scenes = [];
    this.videoDuration = 1;
    this.logo = null; // HTMLImageElement
    this.timeline = { phrases: [], titlePhrase: null };
    this.audioLevel = 0; // 0..1 ses tepkisi (hafif, sakin)
    this._collectBoxes = false; // layout doğrulama modu
    this._boxes = [];
  }

  get ok() {
    return !!this.ctx;
  }

  setTemplate(tpl) {
    this.template = tpl;
  }

  setFields(fields) {
    this.fields = fields;
  }

  setScenes({ scenes, videoDuration }) {
    this.scenes = scenes;
    this.videoDuration = videoDuration || 1;
  }

  setTimeline({ phrases = [], titlePhrase = null } = {}) {
    this.timeline = { phrases, titlePhrase };
  }

  setLogo(img) {
    this.logo = img || null;
  }

  /** Ses seviyesi (analyser) — arka plan ışığına hafif tepki verir */
  setAudioLevel(l) {
    this.audioLevel = clamp(l, 0, 1);
  }

  /** hex → rgba yardımcısı (açık tema dekorları) */
  tint(hex, alpha) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return `rgba(22, 50, 79, ${alpha})`;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  /* ============================================================
     RENDER DÖNGÜSÜ
     ============================================================ */

  renderFrame(t) {
    const ctx = this.ctx;
    if (!ctx || !this.template || !this.fields) return;
    const tpl = this.template;
    const fields = this.fields;
    const cam = tpl.camera || { push: 0.02, driftX: 0, driftY: 0 };

    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // DEKOR katmanı: yavaş kamera push'u + paralaks sürüklenme.
    // Metin katmanına UYGULANMAZ → metin geometrisi sabit, safe-area garantili.
    const prog = clamp01(t / Math.max(1, this.videoDuration));
    const z = 1 + (cam.push || 0.02) * prog;
    const dx = (cam.driftX || 0) * prog * 0.4;
    const dy = (cam.driftY || 0) * prog * 0.4;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2 + dx, -H / 2 + dy);
    this.drawDecor(tpl, Math.max(0, t));
    ctx.restore();

    // Metin sahnesi
    const scene = sceneAt(this.scenes, t);
    if (scene) {
      const p = clamp01((t - scene.start) / scene.dur);
      this.drawScene(scene, p, tpl, fields, t);
      // geçiş dili: accent tonlu ışık süpürmesi (wipe)
      if (tpl.transition === 'wipe') this.lightSweep(p, tpl);
    }

    // Sona doğru global yumuşak karartma (cinematic dissolve)
    if (this.videoDuration > 0.9) {
      const fade = clamp01((this.videoDuration - t) / 0.8);
      if (fade < 1) {
        ctx.globalAlpha = 1 - fade;
        ctx.fillStyle = tpl.bg;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  /**
   * Belirli bir andaki sahnenin GERÇEK metin kutularını doğrular.
   * Kırpma QA kapısı: overflow varsa ihlaller listesinde döner.
   */
  checkSafeArea(t) {
    const violations = [];
    if (!this.ctx) return { ok: true, violations, scene: null, t };
    const scene = sceneAt(this.scenes, t);
    if (!scene || !this.template || !this.fields) {
      return { ok: true, violations, scene: scene ? scene.id : null, t };
    }
    this._collectBoxes = true;
    this._boxes = [];
    this.drawScene(scene, 1, this.template, this.fields, t);
    this._collectBoxes = false;
    for (const b of this._boxes) {
      if (!withinSafe(b.box)) violations.push({ scene: scene.id, text: b.text, box: b.box });
    }
    this._boxes = [];
    return { ok: violations.length === 0, violations, scene: scene.id, t };
  }

  /** Tüm sahnelerin orta noktalarında layout doğrular (üretim kapısı) */
  layoutOk() {
    if (!this.ctx || !this.template || !this.fields || !this.scenes.length) return true;
    for (const s of this.scenes) {
      if (!this.checkSafeArea((s.start + s.end) / 2).ok) return false;
    }
    return true;
  }

  /* ---------------- Geçiş / ışık ---------------- */

  /** Diyagonal ışık süpürmesi — accent tonlu, premium "wipe" hissi */
  lightSweep(p, tpl) {
    if (p > 0.95) return;
    const ctx = this.ctx;
    const enter = easeInOutCubic(clamp01(p / 0.7));
    const x = -0.25 * W + enter * 1.5 * W;
    const c = this.tint(tpl.accent, 0.10);
    const g = ctx.createLinearGradient(x - 260, 0, x + 260, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, c);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 260, 0);
    ctx.lineTo(x + 260, 0);
    ctx.lineTo(x + 520, H);
    ctx.lineTo(x, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* ---------------- Dekor / arka plan (açık, premium) ---------------- */

  drawDecor(tpl, t) {
    const ctx = this.ctx;
    const lvl = this.audioLevel;
    switch (tpl.decor) {
      case 'cinematic': return this.decorCinematic(tpl, t, lvl);
      case 'editorial': return this.decorEditorial(tpl, t, lvl);
      case 'modern': return this.decorModern(tpl, t, lvl);
      case 'rings': {
        ctx.strokeStyle = this.tint(tpl.ink, 0.12);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(40, H - 20, 480, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(40, H - 20, 350, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = this.tint(tpl.accent, 0.18);
        ctx.beginPath();
        ctx.arc(W - 140, 130, 190, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'arch': {
        ctx.fillStyle = this.tint(tpl.accent, 0.10);
        ctx.beginPath();
        ctx.arc(W / 2, 140, 980, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = tpl.accent;
        ctx.beginPath();
        ctx.arc(W / 2, 140, 16, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }

  /** Sinematik (açık): gök mavisi, ışık parlaması (ses tepkili), yumuşak tepeler */
  decorCinematic(tpl, t, lvl) {
    const ctx = this.ctx;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#FDFEFF');
    sky.addColorStop(0.45, tpl.bg);
    sky.addColorStop(0.8, '#DFEBF7');
    sky.addColorStop(1, '#D2E2F1');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const glowA = 0.45 + lvl * 0.22;
    const glow = ctx.createRadialGradient(860, 170, 40, 860, 170, 540);
    glow.addColorStop(0, this.tint(tpl.accent, 0.5 * glowA));
    glow.addColorStop(1, this.tint(tpl.accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    const drift = (t % 24) / 24;
    this.ridge(ctx, { baseY: 1210, amp: 240, freq: 0.0014, phase: drift * 30, color: 'rgba(255,255,255,0.55)' });
    this.ridge(ctx, { baseY: 1330, amp: 180, freq: 0.002, phase: -drift * 20, color: 'rgba(196,220,242,0.55)' });

    const fog = ctx.createLinearGradient(0, 1100, 0, 1500);
    fog.addColorStop(0, 'rgba(255,255,255,0)');
    fog.addColorStop(1, 'rgba(255,255,255,0.55)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 1100, W, 400);
  }

  /** Editoryal: beyaz zemin, ince mavi kılavuz + accent dikey çizgi */
  decorEditorial(tpl, t, lvl) {
    const ctx = this.ctx;
    ctx.fillStyle = tpl.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = this.tint(tpl.ink, 0.07);
    ctx.lineWidth = 2;
    for (let x = 200; x < W; x += 260) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.strokeStyle = this.tint(tpl.accent, 0.55);
    ctx.beginPath();
    ctx.moveTo(104, 300);
    ctx.lineTo(104, H - 260);
    ctx.stroke();
    ctx.fillStyle = this.tint(tpl.ink, 0.85);
    ctx.font = '800 56px "Space Grotesk", sans-serif';
    ctx.fillText('ÖNEMLİ', 120, 190);
    ctx.fillStyle = tpl.accent;
    ctx.fillRect(104, 232, 64, 8);
  }

  /** Modern (açık): yumuşak mavi gradyan + geometrik halkalar */
  decorModern(tpl, t, lvl) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#F3F8FE');
    g.addColorStop(1, tpl.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = this.tint(tpl.ink, 0.07);
    ctx.lineWidth = 2;
    for (let x = 120; x < W; x += 240) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.strokeStyle = this.tint(tpl.accent, 0.4);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W - 120, 140, 300, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W - 120, 140, 210, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = this.tint(tpl.accent, 0.22);
    ctx.beginPath();
    ctx.arc(120, H - 120, 220, 0, Math.PI * 2);
    ctx.fill();
  }

  ridge(ctx, { baseY, amp, freq, phase, color }) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-20, H + 20);
    for (let x = -20; x <= W + 20; x += 22) {
      const y =
        baseY +
        Math.sin(x * freq + phase) * amp +
        Math.sin(x * freq * 2.3 + phase * 1.7) * amp * 0.45;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 20, H + 20);
    ctx.closePath();
    ctx.fill();
  }

  /* ---------------- Sahne giriş/çıkış (safe-area klamplı) ---------------- */

  entrance(p, kind, { enterDur = 0.85, exitStart = 0.92, box = null } = {}) {
    const enter = clamp01(p / enterDur);
    const outP = clamp01((p - exitStart) / (1 - exitStart));
    const outA = 1 - easeInOutCubic(outP);
    let dy = 0, dx = 0, scale = 1;
    switch (kind) {
      case 'up': dy = -(1 - easeOutCubic(enter)) * 60; break;
      case 'left': dx = (1 - easeOutCubic(enter)) * 60; break;
      case 'scale': scale = 0.94 + 0.06 * easeOutCubic(enter); break;
      case 'fade': break;
    }
    if (box) {
      // kutuyu safe-area içinde tut: hareket miktarını marjla sınırla
      if (dy < 0) dy = Math.max(dy, -(box.top - SAFE.top));
      if (dy > 0) dy = Math.min(dy, H - SAFE.bottom - box.bottom);
      if (dx > 0) dx = Math.min(dx, W - SAFE.right - box.right);
      if (dx < 0) dx = Math.max(dx, -(box.left - SAFE.left));
      if (scale !== 1) {
        const cxm = (box.left + box.right) / 2;
        const cym = (box.top + box.bottom) / 2;
        let maxS = Infinity;
        if (cxm - box.left > 0.1) maxS = Math.min(maxS, (cxm - SAFE.left) / (cxm - box.left));
        if (box.right - cxm > 0.1) maxS = Math.min(maxS, (W - SAFE.right - cxm) / (box.right - cxm));
        if (cym - box.top > 0.1) maxS = Math.min(maxS, (cym - SAFE.top) / (cym - box.top));
        if (box.bottom - cym > 0.1) maxS = Math.min(maxS, (H - SAFE.bottom - cym) / (box.bottom - cym));
        if (isFinite(maxS)) scale = Math.min(scale, Math.max(1, maxS));
        else scale = 1;
      }
    }
    return { alpha: enter * outA, dy, dx, scale, enter };
  }

  drawScene(scene, p, tpl, fields, t) {
    switch (scene.type) {
      case 'intro': return this.sceneIntro(p, tpl, fields);
      case 'title': return this.sceneTitle(scene, p, tpl, fields);
      case 'date': return this.sceneInfo('TARİH', (scene.phrase && scene.phrase.display) || fields.date, p, tpl);
      case 'time': return this.sceneInfo('SAAT', (scene.phrase && scene.phrase.display) || fields.time, p, tpl);
      case 'location': return this.sceneInfo('YER', (scene.phrase && scene.phrase.display) || fields.location, p, tpl);
      case 'message': return this.sceneMessage(scene, t, p, tpl, fields);
      case 'outro': return this.sceneOutro(p, tpl, fields);
    }
  }

  /* ---------------- Yazı yardımcıları ---------------- */

  capsLabel(ctx, text, { x, y, align = 'left', tpl, tracking = 0 } = {}) {
    const cfg = tpl.capsLabel;
    ctx.save();
    ctx.font = `${cfg.weight} ${cfg.size}px ${cfg.font}, sans-serif`;
    ctx.fillStyle = tpl.muted;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    this.tracked(ctx, text, x, y, tracking || cfg.tracking);
    ctx.restore();
  }

  tracked(ctx, text, x, y, tracking) {
    if (!tracking) {
      ctx.fillText(text, x, y);
      return;
    }
    if (typeof ctx.letterSpacing === 'string') {
      ctx.letterSpacing = `${tracking}px`;
      ctx.fillText(text, x, y);
      ctx.letterSpacing = '0px';
      return;
    }
    const w = this.measureTracked(ctx, text, tracking);
    let sx = x;
    if (ctx.textAlign === 'center') sx = x - w / 2;
    else if (ctx.textAlign === 'right') sx = x - w;
    ctx.save();
    ctx.textAlign = 'left';
    let cx = sx;
    for (const ch of text) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + tracking;
    }
    ctx.restore();
  }

  measureTracked(ctx, text, tracking) {
    let w = 0;
    for (const ch of text) w += ctx.measureText(ch).width + tracking;
    return w - (text.length ? tracking : 0);
  }

  /**
   * Masked typography reveal — klip kutusu İNME (descent) dahil tam glif
   * kutusunu kaplar; Türkçe karakterler (ş, ç, ğ, y, p...) asla kesilmez.
   */
  maskedLine(ctx, text, x, y, progress, { align = 'center', blur = 0, size = 40, tracking = 0 } = {}) {
    const pr = easeOutCubic(clamp01(progress));
    if (pr <= 0) return;
    const m = ctx.measureText(text);
    const wText = m.width;
    if (!isFinite(wText) || wText <= 0) return;
    const ascent = m.actualBoundingBoxAscent || size * 0.8;
    const descent = m.actualBoundingBoxDescent || size * 0.26;
    const pad = Math.max(6, tracking * 0.5 + 6);
    const x0 = align === 'center' ? x - wText / 2 - pad : x - pad;
    ctx.save();
    if (blur > 0 && typeof ctx.filter === 'string') {
      ctx.filter = `blur(${(1 - pr) * 14}px)`;
    }
    ctx.globalAlpha = ctx.globalAlpha * pr;
    ctx.beginPath();
    ctx.rect(x0, y - ascent * 1.1, wText + pad * 2, (ascent + descent) * 1.1 * pr);
    ctx.clip();
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /* ---------------- Sahneler ---------------- */

  sceneIntro(p, tpl, fields) {
    const ctx = this.ctx;
    const school = fields.school || 'Zeynep Kamil İlkokulu';
    const cx = W / 2;
    const areaTop = 500;
    const fit = fitBlock(ctx, school, {
      maxWidth: 840, maxHeight: 320,
      base: 62, min: 30, weight: 700, font: tpl.title.font, lineHeight: 1.24,
    });
    const y0 = areaTop + fit.size * 0.82;
    const box = blockBox(fit, { x: cx, y: y0, align: 'center' });
    const logoTop = this.logo ? box.top - 96 - 260 : box.top;
    if (this.logo) box.top = logoTop;

    if (this._collectBoxes) {
      this._boxes.push({ text: school, box });
      return;
    }
    const e = this.entrance(p, tpl.motion.enter, { enterDur: 0.9, box });
    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.translate(e.dx, e.dy);
    if (e.scale !== 1) {
      ctx.translate(cx, H / 2);
      ctx.scale(e.scale, e.scale);
      ctx.translate(-cx, -H / 2);
    }

    if (this.logo) {
      const sz = 260;
      const inP = easeOutCubic(clamp01(p / 0.6));
      ctx.save();
      ctx.globalAlpha = e.alpha * inP;
      ctx.drawImage(this.logo, cx - sz / 2, logoTop, sz, sz);
      ctx.restore();
    }

    ctx.font = `700 ${fit.size}px ${tpl.title.font}, sans-serif`;
    ctx.fillStyle = tpl.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const lineH = fit.size * 1.24;
    fit.lines.forEach((line, i) => {
      const lineP = easeOutCubic(clamp01((p - i * 0.12) / 0.5));
      ctx.save();
      ctx.globalAlpha = e.alpha;
      this.maskedLine(ctx, line, cx, y0 + i * lineH, lineP, { align: 'center', size: fit.size });
      ctx.restore();
    });

    const after = y0 + fit.lines.length * lineH + 46;
    const drawP = easeOutCubic(clamp01((p - 0.15) / 0.5));
    const barW = 150 * drawP;
    ctx.fillStyle = tpl.accent;
    ctx.fillRect(cx - barW / 2, after, barW, 8);

    ctx.save();
    ctx.font = `600 24px ${tpl.capsLabel.font}, sans-serif`;
    ctx.fillStyle = tpl.muted;
    ctx.textAlign = 'center';
    ctx.globalAlpha = e.alpha * clamp01((p - 0.35) / 0.4);
    this.tracked(ctx, 'SESLİ DUYURU', cx, after + 52, 6);
    ctx.restore();

    ctx.restore();
  }

  /** Title: greeting phrase'i sesle senkron, masked reveal + blur-to-sharp */
  sceneTitle(scene, p, tpl, fields) {
    const ctx = this.ctx;
    const phrase = scene.phrase || this.timeline.titlePhrase;
    const display = (phrase && phrase.display) || fields.title || 'VELİ MESAJI';
    const t = tpl.title;
    const centered = t.align === 'center';
    const cx = W / 2;
    const x = centered ? cx : SAFE.left + 30;
    const maxW = centered ? 840 : W - SAFE.right - x;
    const titleY = (tpl.layout && tpl.layout.titleY) || 720;
    const fit = fitBlock(ctx, display, {
      maxWidth: maxW, maxHeight: 620,
      base: t.size, min: 34, weight: t.weight, font: t.font, lineHeight: 1.14,
    });
    const y0 = titleY + fit.size * 0.82;
    const box = blockBox(fit, { x, y: y0, align: centered ? 'center' : 'left' });

    if (this._collectBoxes) {
      this._boxes.push({ text: display, box });
      return;
    }
    const e = this.entrance(p, tpl.motion.enter, { enterDur: 0.85, box });
    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.translate(e.dx, e.dy);
    if (e.scale !== 1) {
      ctx.translate(cx, H / 2);
      ctx.scale(e.scale, e.scale);
      ctx.translate(-cx, -H / 2);
    }

    this.capsLabel(ctx, 'DUYURU', { x: centered ? cx : x, y: titleY - 90, align: centered ? 'center' : 'left', tpl, tracking: 5 });

    ctx.font = `${t.weight} ${fit.size}px ${t.font}, sans-serif`;
    ctx.fillStyle = tpl.ink;
    ctx.textAlign = centered ? 'center' : 'left';
    ctx.textBaseline = 'alphabetic';
    const tracking = t.letterSpacing || 0;
    if (typeof ctx.letterSpacing === 'string') ctx.letterSpacing = `${tracking}px`;
    const lineH = fit.size * 1.14;
    fit.lines.forEach((line, i) => {
      const lineP = clamp01((p - i * 0.12) / 0.55);
      ctx.save();
      ctx.globalAlpha = e.alpha;
      this.maskedLine(ctx, line, x, y0 + i * lineH, lineP, { align: centered ? 'center' : 'left', blur: 14, size: fit.size, tracking });
      ctx.restore();
    });
    if (typeof ctx.letterSpacing === 'string') ctx.letterSpacing = '0px';

    const drawP = easeOutCubic(clamp01((p - 0.4) / 0.45));
    const barW = (centered ? 220 : 160) * drawP;
    ctx.globalAlpha = e.alpha;
    ctx.fillStyle = tpl.accent;
    if (centered) ctx.fillRect(cx - barW / 2, y0 + fit.lines.length * lineH + 40, barW, 10);
    else ctx.fillRect(x, y0 + fit.lines.length * lineH + 40, barW, 10);

    ctx.restore();
  }

  /** DATE / TIME / LOCATION — soft reveal; sahne sınırı phrase zamanına bağlı */
  sceneInfo(label, value, p, tpl) {
    const ctx = this.ctx;
    if (!value || !value.trim()) return;
    const centered = tpl.title.align === 'center';
    const cx = W / 2;
    const x = centered ? cx : SAFE.left + 50;
    const maxW = centered ? 840 : W - SAFE.right - x;
    const cy = H / 2 - 60;
    const fit = fitBlock(ctx, value, {
      maxWidth: maxW, maxHeight: 260,
      base: 84, min: 40, weight: 700, font: tpl.title.font, lineHeight: 1.14,
    });
    const y0 = cy + 96 + fit.size * 0.82;
    const box = blockBox(fit, { x, y: y0, align: centered ? 'center' : 'left' });

    if (this._collectBoxes) {
      this._boxes.push({ text: value, box });
      return;
    }
    const e = this.entrance(p, 'fade', { enterDur: 0.7, box });
    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.translate(e.dx, e.dy);
    if (e.scale !== 1) {
      ctx.translate(cx, H / 2);
      ctx.scale(e.scale, e.scale);
      ctx.translate(-cx, -H / 2);
    }

    this.capsLabel(ctx, label, { x: centered ? cx : x, y: cy - 40, align: centered ? 'center' : 'left', tpl, tracking: 6 });

    ctx.font = `700 ${fit.size}px ${tpl.title.font}, sans-serif`;
    ctx.fillStyle = tpl.ink;
    ctx.textAlign = centered ? 'center' : 'left';
    ctx.textBaseline = 'alphabetic';
    const lineH = fit.size * 1.14;
    fit.lines.forEach((line, i) => {
      const lineP = clamp01((p - i * 0.14) / 0.5);
      ctx.save();
      ctx.globalAlpha = e.alpha;
      this.maskedLine(ctx, line, x, y0 + i * lineH, lineP, { align: centered ? 'center' : 'left', size: fit.size });
      ctx.restore();
    });

    const drawP = easeOutCubic(clamp01((p - 0.35) / 0.4));
    const barW = (centered ? 120 : 110) * drawP;
    ctx.globalAlpha = e.alpha;
    ctx.fillStyle = tpl.accent;
    if (centered) ctx.fillRect(cx - barW / 2, y0 + fit.lines.length * lineH + 30, barW, 8);
    else ctx.fillRect(x, y0 + fit.lines.length * lineH + 30, barW, 8);

    ctx.restore();
  }

  /**
   * Message — satırlar MASTER TIMELINE phrase zamanlarıyla belirir:
   * t >= phrase.start olduğu anda satır giriş yapar (senkron kuralı).
   * Sahne çok uzunsa timeline.js onu birden fazla message sahnesine böler;
   * her sahne yalnızca kendi phrase'lerini güvenli alanda çizer.
   */
  sceneMessage(scene, t, p, tpl, fields) {
    const ctx = this.ctx;
    const phrases = (scene.phrases && scene.phrases.length ? scene.phrases : this.timeline.phrases) || [];
    if (!phrases.length) return;

    const centered = tpl.body.align === 'center';
    const cx = W / 2;
    const x = centered ? cx : SAFE.left + 40;
    const maxW = centered ? 840 : W - SAFE.right - (SAFE.left + 40);
    const boxTop = (tpl.layout && tpl.layout.messageBox) ? (H - tpl.layout.messageBox) / 2 : 420;
    const boxH = (tpl.layout && tpl.layout.messageBox) || 1080;

    const size = this._pickMessageSize(phrases, {
      maxW, maxHeight: boxH,
      base: tpl.body.size, min: 26,
      weight: tpl.body.weight, font: tpl.body.font,
      lh: tpl.body.lineHeight,
    });
    const lh = size * tpl.body.lineHeight;

    // satırları efektif boyutta sar (event satırları %8 büyük, accent renk)
    const wrapped = phrases.map((p) => {
      const ps = p.type === 'event' ? size * 1.08 : size;
      const pw = p.type === 'event' ? 800 : tpl.body.weight;
      ctx.font = `${pw} ${ps}px ${tpl.body.font}, sans-serif`;
      return { ...p, lines: wrapLinesStrict(ctx, p.display, maxW), ps, isEvent: p.type === 'event' };
    });
    let total = 0;
    for (const w of wrapped) total += w.lines.length;
    const topY = boxTop + (boxH - total * lh) / 2;
    const y0 = topY + size * 0.82;
    let blockWidth = 0;
    for (const w of wrapped) {
      ctx.font = `${w.isEvent ? 800 : tpl.body.weight} ${w.ps}px ${tpl.body.font}, sans-serif`;
      for (const l of w.lines) blockWidth = Math.max(blockWidth, measureWidth(ctx, l));
    }
    const block = {
      left: centered ? cx - blockWidth / 2 : x,
      right: centered ? cx + blockWidth / 2 : x + maxW,
      top: topY,
      bottom: topY + total * lh,
    };

    if (this._collectBoxes) {
      this._boxes.push({ text: phrases.map((p) => p.display).join(' '), box: block });
      return;
    }
    const e = this.entrance(p, tpl.motion.enter, { enterDur: 0.4, box: block });
    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.translate(e.dx, e.dy);
    if (e.scale !== 1) {
      ctx.translate(cx, H / 2);
      ctx.scale(e.scale, e.scale);
      ctx.translate(-cx, -H / 2);
    }

    let y = y0;
    for (const ph of wrapped) {
      const local = t - ph.start;
      const prog = clamp01(local / 0.35);
      if (prog > 0) {
        ctx.font = `${ph.isEvent ? 800 : tpl.body.weight} ${ph.ps}px ${tpl.body.font}, sans-serif`;
        ctx.fillStyle = ph.isEvent ? tpl.accent : tpl.ink;
        ctx.textAlign = centered ? 'center' : 'left';
        ctx.textBaseline = 'alphabetic';
        for (const line of ph.lines) {
          const dy = (1 - easeOutCubic(clamp01(local / 0.35))) * 22;
          ctx.save();
          this.maskedLine(ctx, line, x, y + dy, prog, { align: centered ? 'center' : 'left', size: ph.ps });
          ctx.restore();
          y += lh;
        }
      } else {
        y += ph.lines.length * lh;
      }
    }

    if (!centered) {
      const drawP = easeOutCubic(clamp01((p - 0.1) / 0.85));
      ctx.strokeStyle = tpl.accent;
      ctx.lineWidth = 6;
      ctx.globalAlpha = e.alpha * 0.9;
      ctx.beginPath();
      ctx.moveTo(x - 46, topY + total * lh);
      ctx.lineTo(x - 46, topY + total * lh - (total * lh + 20) * drawP);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Mesaj sahnesi için ortak font boyutu: tüm phrase'leri sığdıran en büyük boyut */
  _pickMessageSize(phrases, { maxW, maxHeight, base, min, weight, font, lh, maxLines = 26 }) {
    const ctx = this.ctx;
    const test = (size) => {
      let total = 0;
      for (const p of phrases) {
        const ps = p.type === 'event' ? size * 1.08 : size;
        const pw = p.type === 'event' ? 800 : weight;
        ctx.font = `${pw} ${ps}px ${font}, sans-serif`;
        const ls = wrapLinesStrict(ctx, p.display, maxW);
        total += ls.length;
        if (total > maxLines) return null;
        for (const l of ls) {
          if (measureWidth(ctx, l) > maxW + 0.5) return null;
        }
      }
      const height = total * size * lh;
      if (height <= maxHeight + 0.5) return { size, total };
      return null;
    };
    for (let size = base; size >= min; size -= 2) {
      const r = test(size);
      if (r) return r.size;
    }
    const r = test(min);
    return r ? r.size : min;
  }

  sceneOutro(p, tpl, fields) {
    const ctx = this.ctx;
    const cx = W / 2;
    const sign = fields.sign || 'Teşekkür ederiz';
    const school = fields.school;
    const title = tpl.decor === 'arch' ? 'Görüşmek dileğiyle' : 'TEŞEKKÜRLER';

    const fit = fitBlock(ctx, title, {
      maxWidth: 840, maxHeight: 340,
      base: 84, min: 40, weight: 800, font: tpl.title.font, lineHeight: 1.14,
    });
    const y0 = H / 2 - 160 + fit.size * 0.82;
    const box = blockBox(fit, { x: cx, y: y0, align: 'center' });

    const sFit = fitBlock(ctx, sign, {
      maxWidth: 840, maxHeight: 220,
      base: 44, min: 26, weight: 500, font: tpl.body.font, lineHeight: 1.3,
    });
    const sy = H / 2 + 60 + sFit.size * 0.82;
    const sBox = blockBox(sFit, { x: cx, y: sy, align: 'center' });

    let kBox = null;
    let kFit = null;
    if (school) {
      kFit = fitBlock(ctx, school, {
        maxWidth: 840, maxHeight: 170,
        base: 26, min: 16, weight: 600, font: tpl.capsLabel.font, lineHeight: 1.25,
      });
      const ky = H - 200 + kFit.size * 0.82;
      kBox = blockBox(kFit, { x: cx, y: ky, align: 'center' });
    }

    if (this._collectBoxes) {
      this._boxes.push({ text: title, box });
      this._boxes.push({ text: sign, box: sBox });
      if (kBox) this._boxes.push({ text: school, box: kBox });
      return;
    }
    const e = this.entrance(p, tpl.motion.enter, { enterDur: 0.85, exitStart: 0.94, box });
    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.translate(e.dx, e.dy);
    if (e.scale !== 1) {
      ctx.translate(cx, H / 2);
      ctx.scale(e.scale, e.scale);
      ctx.translate(-cx, -H / 2);
    }

    ctx.font = `800 ${fit.size}px ${tpl.title.font}, sans-serif`;
    ctx.fillStyle = tpl.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const lineH = fit.size * 1.14;
    fit.lines.forEach((line, i) => {
      const lineP = clamp01((p - 0.1 - i * 0.12) / 0.5);
      ctx.save();
      ctx.globalAlpha = e.alpha;
      this.maskedLine(ctx, line, cx, y0 + i * lineH, lineP, { align: 'center', size: fit.size });
      ctx.restore();
    });

    ctx.save();
    ctx.globalAlpha = e.alpha * clamp01((p - 0.35) / 0.4);
    ctx.font = `500 ${sFit.size}px ${tpl.body.font}, sans-serif`;
    ctx.fillStyle = tpl.muted;
    ctx.textAlign = 'center';
    sFit.lines.forEach((line, i) => {
      ctx.fillText(line, cx, sy + i * sFit.size * 1.3);
    });
    ctx.restore();

    if (school && kFit) {
      ctx.save();
      ctx.globalAlpha = e.alpha * clamp01((p - 0.5) / 0.35);
      ctx.font = `600 ${kFit.size}px ${tpl.capsLabel.font}, sans-serif`;
      ctx.fillStyle = tpl.muted;
      ctx.textAlign = 'center';
      kFit.lines.forEach((line, i) => {
        ctx.fillText(line.toLocaleUpperCase('tr-TR'), cx, H - 200 + i * kFit.size * 1.25);
      });
      ctx.restore();
    }

    ctx.restore();
  }
}

export { W as VIDEO_W, H as VIDEO_H };
