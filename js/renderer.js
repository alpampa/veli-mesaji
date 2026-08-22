/* StudioRenderer — 1080×1920 canvas üzerinde hem canlı önizlemeyi hem
 * dışa aktarımı besleyen tek render motoru (WYSIWYG).
 *
 * Zamanlama: MASTER TIMELINE'a bağlıdır (js/timeline.js). Sahne sınırları ve
 * mesaj satırları gerçek TTS kelime zamanlamalarından gelir; çizim her karede
 * global t üzerinden yapılır → preview ile final MP4 birebir aynıdır.
 *
 * Motion dili: slow camera push, parallax, masked typography reveal,
 * blur-to-sharp, light sweep, cinematic dissolve, layered motion.
 */

import {
  clamp, clamp01, easeOutCubic, easeInOutCubic,
  fitFontSize, drawRoundRect,
} from './utils.js';
import { sceneAt } from './timeline.js';

const W = 1080;
const H = 1920;

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

  renderFrame(t) {
    const ctx = this.ctx;
    if (!ctx || !this.template || !this.fields) return;
    const tpl = this.template;
    const fields = this.fields;
    const cam = tpl.camera || { push: 0.02, driftX: 0, driftY: 0 };

    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // Arka plan + dekor: yavaş kamera push'u + hafif sürüklenme (parallax)
    const prog = clamp01(t / Math.max(1, this.videoDuration));
    const z = 1 + (cam.push || 0.02) * prog;
    const dx = (cam.driftX || 0) * prog * 0.4;
    const dy = (cam.driftY || 0) * prog * 0.4;
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2 + dx, -H / 2 + dy);
    this.drawDecor(tpl, Math.max(0, t));
    ctx.restore();

    // Aktif sahne
    const scene = sceneAt(this.scenes, t);
    if (scene) {
      const p = clamp01((t - scene.start) / scene.dur);
      this.drawScene(scene, p, tpl, fields, t);
      // geçiş dili: light sweep (wipe)
      if (tpl.transition === 'wipe') this.lightSweep(p);
    }

    // Sona doğru global karartma (cinematic dissolve)
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

  /* ---------------- Geçiş / ışık ---------------- */

  /** Diyagonal ışık süpürmesi — profesyonel "wipe" hissi */
  lightSweep(p) {
    if (p > 0.95) return;
    const ctx = this.ctx;
    const enter = easeInOutCubic(clamp01(p / 0.7));
    const x = -0.25 * W + enter * 1.5 * W;
    const g = ctx.createLinearGradient(x - 260, 0, x + 260, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.10)');
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

  /* ---------------- Dekor / arka plan ---------------- */

  drawDecor(tpl, t) {
    const ctx = this.ctx;
    const lvl = this.audioLevel;
    switch (tpl.decor) {
      case 'cinematic':
        return this.decorCinematic(t, lvl);
      case 'editorial':
        return this.decorEditorial(t, lvl);
      case 'modern':
        return this.decorModern(t, lvl);
      case 'rings': {
        ctx.strokeStyle = tpl.line;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(40, H - 20, 480, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(40, H - 20, 350, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = tpl.surface;
        ctx.beginPath();
        ctx.arc(W - 140, 130, 190, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'arch': {
        ctx.fillStyle = tpl.surface;
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

  /** Sinematik: gökyüzü, ışık huzmesi (ses tepkili), paralaks dağlar, sis, vinyet */
  decorCinematic(t, lvl) {
    const ctx = this.ctx;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0A0F15');
    sky.addColorStop(0.55, '#13212C');
    sky.addColorStop(0.8, '#1E2C31');
    sky.addColorStop(1, '#171D1E');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // ışık huzmesi — ses seviyesiyle çok hafif parlar
    const beamA = 0.14 + lvl * 0.07;
    const beam = ctx.createLinearGradient(640, 0, 1080, 640);
    beam.addColorStop(0, `rgba(242, 181, 68, ${beamA})`);
    beam.addColorStop(1, 'rgba(242, 181, 68, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(780, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, 760);
    ctx.lineTo(880, 240);
    ctx.closePath();
    ctx.fill();

    const drift = (t % 20) / 20;
    this.ridge(ctx, { baseY: 1210, amp: 300, freq: 0.0016, phase: drift * 40, color: 'rgba(30, 44, 56, 0.95)' });
    this.ridge(ctx, { baseY: 1330, amp: 220, freq: 0.0023, phase: -drift * 26, color: 'rgba(16, 23, 30, 0.98)' });

    const fog = ctx.createLinearGradient(0, 1050, 0, 1500);
    fog.addColorStop(0, 'rgba(11, 16, 22, 0)');
    fog.addColorStop(1, 'rgba(11, 16, 22, 0.5)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 1050, W, 450);

    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.98);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    for (let i = 0; i < 150; i++) {
      ctx.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4);
    }
  }

  /** Editoryal: dikey kılavuz çizgiler + dergi numarası + köşe vurgusu */
  decorEditorial(t, lvl) {
    const ctx = this.ctx;
    ctx.fillStyle = '#F7F5F0';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(23, 19, 16, 0.10)';
    ctx.lineWidth = 2;
    for (let x = 200; x < W; x += 260) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(23, 19, 16, 0.28)';
    ctx.beginPath();
    ctx.moveTo(104, 300);
    ctx.lineTo(104, H - 260);
    ctx.stroke();
    ctx.fillStyle = 'rgba(23, 19, 16, 0.85)';
    ctx.font = '800 56px "Space Grotesk", sans-serif';
    ctx.fillText('ÖNEMLİ', 120, 190);
    ctx.fillStyle = this.template.accent;
    ctx.fillRect(104, 232, 64, 8);
  }

  /** Modern: koyu zemin + geometrik halkalar + ince ızgara */
  decorModern(t, lvl) {
    const ctx = this.ctx;
    ctx.fillStyle = '#12151B';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(242, 244, 246, 0.05)';
    ctx.lineWidth = 2;
    for (let x = 120; x < W; x += 240) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(232, 180, 76, 0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W - 120, 140, 300, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W - 120, 140, 210, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(14, 124, 107, 0.35)';
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

  /* ---------------- Sahne giriş/çıkış ---------------- */

  entrance(p, kind, { enterDur = 0.85, exitStart = 0.92 } = {}) {
    const enter = clamp01(p / enterDur);
    const outP = clamp01((p - exitStart) / (1 - exitStart));
    const outA = 1 - easeInOutCubic(outP);
    let dy = 0, dx = 0, scale = 1;
    switch (kind) {
      case 'up': dy = (1 - easeOutCubic(enter)) * 80; break;
      case 'left': dx = (1 - easeOutCubic(enter)) * 100; break;
      case 'scale': scale = 0.9 + 0.1 * easeOutCubic(enter); break;
      case 'fade': break;
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
      case 'message': return this.sceneMessage(t, p, tpl, fields);
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

  /** Masked typography reveal: metin yukarıdan aşağı maske ile açılır */
  maskedLine(ctx, text, x, y, progress, { align = 'center', blur = 0 } = {}) {
    const pr = easeOutCubic(clamp01(progress));
    if (pr <= 0) return;
    const ctx2 = ctx;
    ctx2.save();
    if (blur > 0 && typeof ctx2.filter === 'string') {
      ctx2.filter = `blur(${(1 - pr) * 18}px)`;
    }
    ctx2.globalAlpha = ctx2.globalAlpha * pr;
    const h = (ctx2.measureText(text).actualBoundingBoxAscent || ctx2.measureText(text).width * 0.8) * 1.4;
    const wText = ctx2.measureText(text).width;
    const x0 = align === 'center' ? x - wText / 2 - 14 : x - 14;
    ctx2.beginPath();
    ctx2.rect(x0, y - h, wText + 28, h * pr);
    ctx2.clip();
    ctx2.fillText(text, x, y);
    ctx2.restore();
  }

  /* ---------------- Sahneler ---------------- */

  sceneIntro(p, tpl, fields) {
    const ctx = this.ctx;
    const e = this.entrance(p, tpl.motion.enter, { enterDur: 0.9 });
    const school = fields.school || 'Zeynep Kamil İlkokulu';
    const cx = W / 2;
    let y0 = H / 2 - 180;

    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.translate(e.dx, e.dy);
    if (e.scale !== 1) {
      ctx.translate(cx, H / 2);
      ctx.scale(e.scale, e.scale);
      ctx.translate(-cx, -H / 2);
    }

    if (this.logo) {
      const sz = 280;
      const inP = easeOutCubic(clamp01(p / 0.6));
      ctx.save();
      ctx.globalAlpha = e.alpha * inP;
      ctx.drawImage(this.logo, cx - sz / 2, y0 - sz - 70 + (1 - inP) * 40, sz, sz);
      ctx.restore();
    }

    const fit = fitFontSize(ctx, school, {
      maxWidth: tpl.title.maxWidth + 60,
      maxHeight: 260,
      base: 62,
      min: 34,
      weight: 700,
      font: tpl.title.font,
    });
    ctx.font = `${700} ${fit.size}px ${tpl.title.font}, sans-serif`;
    ctx.fillStyle = tpl.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const lineH = fit.size * 1.24;
    fit.lines.forEach((line, i) => ctx.fillText(line, cx, y0 + i * lineH));
    y0 += fit.lines.length * lineH + 46;

    const drawP = easeOutCubic(clamp01((p - 0.15) / 0.5));
    const barW = 150 * drawP;
    ctx.fillStyle = tpl.accent;
    ctx.fillRect(cx - barW / 2, y0, barW, 8);
    y0 += 52;

    ctx.save();
    ctx.font = `600 24px ${tpl.capsLabel.font}, sans-serif`;
    ctx.fillStyle = tpl.muted;
    ctx.textAlign = 'center';
    ctx.globalAlpha = e.alpha * clamp01((p - 0.35) / 0.4);
    this.tracked(ctx, 'SESLİ DUYURU', cx, y0, 6);
    ctx.restore();

    ctx.restore();
  }

  /** Title: greeting phrase'i sesle senkron, masked reveal + blur-to-sharp */
  sceneTitle(scene, p, tpl, fields) {
    const ctx = this.ctx;
    const e = this.entrance(p, tpl.motion.enter, { enterDur: 0.85 });
    const phrase = scene.phrase || this.timeline.titlePhrase;
    const display = (phrase && phrase.display) || fields.title || 'VELİ MESAJI';
    const t = tpl.title;
    const centered = t.align === 'center';
    const cx = W / 2;
    const x = centered ? cx : 150;
    const y = (tpl.layout && tpl.layout.titleY) || 720;

    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.translate(e.dx, e.dy);
    if (e.scale !== 1) {
      ctx.translate(cx, H / 2);
      ctx.scale(e.scale, e.scale);
      ctx.translate(-cx, -H / 2);
    }

    this.capsLabel(ctx, 'DUYURU', { x: centered ? cx : x, y: y - 90, align: centered ? 'center' : 'left', tpl, tracking: 5 });

    const fit = fitFontSize(ctx, display, {
      maxWidth: t.maxWidth,
      maxHeight: 560,
      base: t.size,
      min: 44,
      weight: t.weight,
      font: t.font,
    });
    ctx.font = `${t.weight} ${fit.size}px ${t.font}, sans-serif`;
    ctx.fillStyle = tpl.ink;
    ctx.textAlign = centered ? 'center' : 'left';
    ctx.textBaseline = 'alphabetic';
    if (typeof ctx.letterSpacing === 'string') ctx.letterSpacing = `${t.letterSpacing || 0}px`;
    const lineH = fit.size * 1.16;
    fit.lines.forEach((line, i) => {
      const lineP = clamp01((p - i * 0.12) / 0.55);
      ctx.save();
      ctx.globalAlpha = e.alpha;
      this.maskedLine(ctx, line, x, y + i * lineH, lineP, { align: centered ? 'center' : 'left', blur: 18 });
      ctx.restore();
    });
    ctx.globalAlpha = e.alpha;
    if (typeof ctx.letterSpacing === 'string') ctx.letterSpacing = '0px';

    const drawP = easeOutCubic(clamp01((p - 0.4) / 0.45));
    const barW = (centered ? 220 : 160) * drawP;
    ctx.fillStyle = tpl.accent;
    if (centered) ctx.fillRect(cx - barW / 2, y + fit.lines.length * lineH + 50, barW, 10);
    else ctx.fillRect(x, y + fit.lines.length * lineH + 50, barW, 10);

    ctx.restore();
  }

  /** DATE / TIME / LOCATION — soft reveal; sahne sınırı phrase zamanına bağlı */
  sceneInfo(label, value, p, tpl) {
    const ctx = this.ctx;
    if (!value || !value.trim()) return;
    const e = this.entrance(p, 'fade', { enterDur: 0.7 });
    const centered = tpl.title.align === 'center';
    const cx = W / 2;
    const x = centered ? cx : 170;

    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.translate(e.dx, e.dy);
    if (e.scale !== 1) {
      ctx.translate(cx, H / 2);
      ctx.scale(e.scale, e.scale);
      ctx.translate(-cx, -H / 2);
    }

    const cy = H / 2 - 60;
    this.capsLabel(ctx, label, { x: centered ? cx : x, y: cy - 40, align: centered ? 'center' : 'left', tpl, tracking: 6 });

    const fit = fitFontSize(ctx, value, {
      maxWidth: 900,
      maxHeight: 190,
      base: 84,
      min: 40,
      weight: 700,
      font: tpl.title.font,
    });
    ctx.font = `700 ${fit.size}px ${tpl.title.font}, sans-serif`;
    ctx.fillStyle = tpl.ink;
    ctx.textAlign = centered ? 'center' : 'left';
    ctx.textBaseline = 'alphabetic';
    const lineH = fit.size * 1.15;
    fit.lines.forEach((line, i) => {
      const lineP = clamp01((p - i * 0.14) / 0.5);
      ctx.save();
      ctx.globalAlpha = e.alpha;
      this.maskedLine(ctx, line, x, cy + 96 + i * lineH, lineP, { align: centered ? 'center' : 'left' });
      ctx.restore();
    });

    const drawP = easeOutCubic(clamp01((p - 0.35) / 0.4));
    const barW = (centered ? 120 : 110) * drawP;
    ctx.globalAlpha = e.alpha;
    ctx.fillStyle = tpl.accent;
    if (centered) ctx.fillRect(cx - barW / 2, cy + 96 + fit.lines.length * lineH + 34, barW, 8);
    else ctx.fillRect(x, cy + 96 + fit.lines.length * lineH + 34, barW, 8);

    ctx.restore();
  }

  /**
   * Message — satırlar MASTER TIMELINE phrase zamanlarıyla belirir:
   * t >= phrase.start olduğu anda satır giriş yapar (senkron kuralı).
   */
  sceneMessage(t, p, tpl, fields) {
    const ctx = this.ctx;
    const e = this.entrance(p, tpl.motion.enter, { enterDur: 0.4 });
    const lines = this.timeline.phrases || [];
    if (!lines.length) return;

    const centered = tpl.body.align === 'center';
    const cx = W / 2;
    const x = centered ? cx : 170;
    const maxW = tpl.body.maxWidth;
    const boxH = (tpl.layout && tpl.layout.messageBox) || 1080;
    const y0 = (H - boxH) / 2;

    // en uzun satıra göre font ölçekle
    const longest = lines.reduce((a, l) => (l.display.length > a.display.length ? l : a), lines[0]);
    const fit = fitFontSize(ctx, longest.display, {
      maxWidth: maxW,
      maxHeight: boxH,
      base: tpl.body.size,
      min: 28,
      weight: tpl.body.weight,
      font: tpl.body.font,
      lineHeight: tpl.body.lineHeight,
    });
    const lh = fit.size * tpl.body.lineHeight;
    const totalH = lines.length * lh;
    let y = y0 + (boxH - totalH) / 2;

    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.translate(e.dx, e.dy);

    lines.forEach((line) => {
      const local = t - line.start; // MASTER clock
      const prog = clamp01(local / 0.35);
      if (prog <= 0) return;
      const isEvent = line.type === 'event';
      const size = isEvent ? fit.size * 1.12 : fit.size;
      const weight = isEvent ? 800 : tpl.body.weight;
      const color = isEvent ? tpl.accent : tpl.ink;
      ctx.font = `${weight} ${size}px ${tpl.body.font}, sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = centered ? 'center' : 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.save();
      ctx.globalAlpha = e.alpha * easeOutCubic(prog);
      const dy = (1 - easeOutCubic(prog)) * 26;
      this.maskedLine(ctx, line.display, x, y + dy, prog, { align: centered ? 'center' : 'left' });
      ctx.restore();
      y += lh;
    });

    if (!centered) {
      const drawP = easeOutCubic(clamp01((p - 0.1) / 0.85));
      ctx.strokeStyle = tpl.accent;
      ctx.lineWidth = 6;
      ctx.globalAlpha = e.alpha * 0.9;
      ctx.beginPath();
      ctx.moveTo(x - 46, y0 + totalH);
      ctx.lineTo(x - 46, y0 + totalH - (totalH + 20) * drawP);
      ctx.stroke();
    }

    ctx.restore();
  }

  sceneOutro(p, tpl, fields) {
    const ctx = this.ctx;
    const e = this.entrance(p, tpl.motion.enter, { enterDur: 0.85, exitStart: 0.94 });
    const cx = W / 2;
    const sign = fields.sign || 'Teşekkür ederiz';
    const school = fields.school;

    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.translate(e.dx, e.dy);
    if (e.scale !== 1) {
      ctx.translate(cx, H / 2);
      ctx.scale(e.scale, e.scale);
      ctx.translate(-cx, -H / 2);
    }

    const title = tpl.decor === 'warm' ? 'Görüşmek dileğiyle' : 'TEŞEKKÜRLER';
    const fit = fitFontSize(ctx, title, {
      maxWidth: 900,
      maxHeight: 300,
      base: 84,
      min: 40,
      weight: 800,
      font: tpl.title.font,
    });
    ctx.font = `${800} ${fit.size}px ${tpl.title.font}, sans-serif`;
    ctx.fillStyle = tpl.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const lineH = fit.size * 1.14;
    fit.lines.forEach((line, i) => {
      const lineP = clamp01((p - 0.1 - i * 0.12) / 0.5);
      ctx.save();
      ctx.globalAlpha = e.alpha;
      this.maskedLine(ctx, line, cx, H / 2 - 160 + i * lineH, lineP, { align: 'center' });
      ctx.restore();
    });

    ctx.save();
    ctx.globalAlpha = e.alpha * clamp01((p - 0.35) / 0.4);
    ctx.font = `500 44px ${tpl.body.font}, sans-serif`;
    ctx.fillStyle = tpl.muted;
    ctx.textAlign = 'center';
    ctx.fillText(sign, cx, H / 2 + 60);
    ctx.restore();

    if (school) {
      ctx.save();
      ctx.globalAlpha = e.alpha * clamp01((p - 0.5) / 0.35);
      ctx.font = `600 26px ${tpl.capsLabel.font}, sans-serif`;
      ctx.fillStyle = tpl.muted;
      ctx.textAlign = 'center';
      this.tracked(ctx, school.toLocaleUpperCase('tr-TR'), cx, H - 200, 4);
      ctx.restore();
    }

    ctx.restore();
  }
}

export { W as VIDEO_W, H as VIDEO_H };
