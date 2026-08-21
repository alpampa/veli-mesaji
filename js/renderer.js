/* StudioRenderer — 1080×1920 canvas üzerinde hem canlı önizlemeyi hem
 * dışa aktarımı besleyen tek render motoru (WYSIWYG).
 *
 * Sahneler: intro → title → date → message → outro.
 * Her sahne şablonun motion diliyle girer ve yumuşak geçişlerle çıkar.
 */

import {
  clamp, clamp01, easeOutCubic, easeInOutCubic,
  wrapLines, fitFontSize, drawRoundRect,
} from './utils.js';
import { sceneAt } from './scenes.js';

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

  setLogo(img) {
    this.logo = img || null;
  }

  /** Belirli bir andaki kareyi çizer */
  renderFrame(t) {
    const ctx = this.ctx;
    if (!ctx || !this.template || !this.fields) return;
    const tpl = this.template;
    const fields = this.fields;

    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // Arka plan
    ctx.fillStyle = tpl.bg;
    ctx.fillRect(0, 0, W, H);

    // Dekor (çok yumuşak zoom)
    ctx.save();
    const z = 1 + 0.035 * clamp01(t / Math.max(1, this.videoDuration));
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    this.drawDecor(tpl);
    ctx.restore();

    // Aktif sahne
    const scene = sceneAt(this.scenes, t);
    if (scene) {
      const p = clamp01((t - scene.start) / scene.dur);
      this.drawScene(scene.type, p, tpl, fields);
    }

    // Sona doğru global karartma
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

  /* ---------------- Dekor ---------------- */

  drawDecor(tpl) {
    const ctx = this.ctx;
    switch (tpl.decor) {
      case 'editorial': {
        // ince dikey çizgi + köşe vurgusu
        ctx.strokeStyle = tpl.line;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(104, 320);
        ctx.lineTo(104, H - 320);
        ctx.stroke();
        ctx.fillStyle = tpl.accent;
        ctx.fillRect(104, 196, 30, 30);
        break;
      }
      case 'institution': {
        // çerçeve + sağ üst yumuşak daire
        ctx.strokeStyle = tpl.line;
        ctx.lineWidth = 3;
        drawRoundRect(ctx, 58, 58, W - 116, H - 116, 14);
        ctx.stroke();
        ctx.fillStyle = tpl.surface;
        ctx.beginPath();
        ctx.arc(W - 60, 120, 430, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = tpl.accent;
        ctx.fillRect(58, H - 66, 220, 8);
        break;
      }
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
      case 'alert': {
        ctx.fillStyle = tpl.accent;
        ctx.fillRect(0, 0, W, 18);
        ctx.fillRect(0, H - 18, W, 18);
        ctx.strokeStyle = tpl.line;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(104, 300);
        ctx.lineTo(104, H - 300);
        ctx.stroke();
        break;
      }
    }
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
    return { alpha: enter * outA, dy, dx, scale };
  }

  drawScene(type, p, tpl, fields) {
    switch (type) {
      case 'intro': return this.sceneIntro(p, tpl, fields);
      case 'title': return this.sceneTitle(p, tpl, fields);
      case 'date': return this.sceneDate(p, tpl, fields);
      case 'message': return this.sceneMessage(p, tpl, fields);
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

  /** Harf aralığını destekleyen tarayıcıda letterSpacing, yoksa elle çizer */
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

  /* ---------------- Sahneler ---------------- */

  sceneIntro(p, tpl, fields) {
    const ctx = this.ctx;
    const e = this.entrance(p, tpl.motion.enter, { enterDur: 0.9 });

    const school = fields.school || 'Zeynep Kamil İlkokulu';
    const cx = W / 2;
    let y0 = H / 2 - 180;

    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.translate(e.dx, e.dy + (e.scale !== 1 ? (1 - e.scale) * H / 2 : 0));
    if (e.scale !== 1) {
      ctx.translate(cx, H / 2);
      ctx.scale(e.scale, e.scale);
      ctx.translate(-cx, -H / 2);
    }

    // Logo
    if (this.logo) {
      const sz = 280;
      const lx = cx - sz / 2;
      const ly = y0 - sz - 60;
      const inP = easeOutCubic(clamp01(p / 0.6));
      ctx.save();
      ctx.globalAlpha = e.alpha * inP;
      ctx.drawImage(this.logo, lx, ly + (1 - inP) * 40, sz, sz);
      ctx.restore();
    }

    // Okul adı
    const fit = fitFontSize(ctx, school, {
      maxWidth: tpl.title.maxWidth + 60,
      maxHeight: 260,
      base: tpl.decor === 'institution' ? 66 : 62,
      min: 34,
      weight: 700,
      font: tpl.title.font,
    });
    ctx.font = `${700} ${fit.size}px ${tpl.title.font}, sans-serif`;
    ctx.fillStyle = tpl.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const lineH = fit.size * 1.24;
    fit.lines.forEach((line, i) => {
      ctx.fillText(line, cx, y0 + i * lineH);
    });
    y0 += fit.lines.length * lineH + 46;

    // Vurgu çizgisi
    const drawP = easeOutCubic(clamp01((p - 0.15) / 0.5));
    const barW = 150 * drawP;
    ctx.fillStyle = tpl.accent;
    ctx.fillRect(cx - barW / 2, y0, barW, 8);
    y0 += 52;

    // Alt etiket
    ctx.save();
    ctx.font = `600 24px ${tpl.capsLabel.font}, sans-serif`;
    ctx.fillStyle = tpl.muted;
    ctx.textAlign = 'center';
    ctx.globalAlpha = e.alpha * clamp01((p - 0.35) / 0.4);
    this.tracked(ctx, 'SESLİ DUYURU', cx, y0, 6);
    ctx.restore();

    ctx.restore();
  }

  sceneTitle(p, tpl, fields) {
    const ctx = this.ctx;
    const e = this.entrance(p, tpl.motion.enter, { enterDur: 0.8 });
    const title = fields.title || 'VELİ MESAJI';
    const t = tpl.title;
    const centered = t.align === 'center';
    const cx = W / 2;
    const x = centered ? cx : 150;
    let y = 720;

    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.translate(e.dx, e.dy + (e.scale !== 1 ? (1 - e.scale) * H / 2 : 0));
    if (e.scale !== 1) {
      ctx.translate(cx, H / 2);
      ctx.scale(e.scale, e.scale);
      ctx.translate(-cx, -H / 2);
    }

    // üst etiket
    this.capsLabel(ctx, 'DUYURU', { x: centered ? cx : x, y: y - 90, align: centered ? 'center' : 'left', tpl, tracking: 5 });

    // başlık
    const display = t.uppercase ? title.toLocaleUpperCase('tr-TR') : title;
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
      ctx.globalAlpha = e.alpha * easeOutCubic(lineP);
      ctx.translate(0, (1 - easeOutCubic(lineP)) * 30);
      ctx.fillText(line, x, y + i * lineH);
      ctx.translate(0, -(1 - easeOutCubic(lineP)) * 30);
    });
    ctx.globalAlpha = e.alpha;
    if (typeof ctx.letterSpacing === 'string') ctx.letterSpacing = '0px';

    // vurgu
    const drawP = easeOutCubic(clamp01((p - 0.4) / 0.45));
    const barW = (centered ? 220 : 160) * drawP;
    ctx.fillStyle = tpl.accent;
    if (centered) ctx.fillRect(cx - barW / 2, y + fit.lines.length * lineH + 50, barW, 10);
    else ctx.fillRect(x, y + fit.lines.length * lineH + 50, barW, 10);

    ctx.restore();
  }

  sceneDate(p, tpl, fields) {
    const ctx = this.ctx;
    const e = this.entrance(p, tpl.motion.enter, { enterDur: 0.8 });
    const rows = [
      fields.date && { label: 'TARİH', value: fields.date },
      fields.time && { label: 'SAAT', value: fields.time },
      fields.location && { label: 'YER', value: fields.location },
    ].filter(Boolean);
    if (!rows.length) return;

    const centered = tpl.title.align === 'center';
    const cx = W / 2;
    const leftX = 170;
    const totalH = rows.length * 210 - 30;
    let y = (H - totalH) / 2 - 40;

    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.translate(e.dx, e.dy);

    rows.forEach((row, i) => {
      const rowP = clamp01((p - i * 0.16) / 0.55);
      const a = easeOutCubic(rowP);
      const ry = y + i * 210 + (1 - a) * 46;
      const x = centered ? cx : leftX;

      // ayraç
      if (i > 0) {
        ctx.strokeStyle = tpl.line;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (centered) {
          ctx.moveTo(cx - 120, ry - 66);
          ctx.lineTo(cx + 120, ry - 66);
        } else {
          ctx.moveTo(leftX, ry - 66);
          ctx.lineTo(leftX + 640, ry - 66);
        }
        ctx.stroke();
      }

      ctx.save();
      ctx.globalAlpha = e.alpha * a;
      this.capsLabel(ctx, row.label, { x: centered ? cx : x, y: ry, align: centered ? 'center' : 'left', tpl, tracking: 5 });

      const fit = fitFontSize(ctx, row.value, {
        maxWidth: 820,
        maxHeight: 130,
        base: 66,
        min: 34,
        weight: 700,
        font: tpl.title.font,
      });
      ctx.font = `700 ${fit.size}px ${tpl.title.font}, sans-serif`;
      ctx.fillStyle = tpl.ink;
      ctx.textAlign = centered ? 'center' : 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(fit.lines[0], x, ry + 96);
      ctx.restore();
    });

    ctx.restore();
  }

  sceneMessage(p, tpl, fields) {
    const ctx = this.ctx;
    const e = this.entrance(p, tpl.motion.enter, { enterDur: 0.55 });
    const text = (fields.body || '').trim();
    if (!text) return;

    const centered = tpl.body.align === 'center';
    const cx = W / 2;
    const x = centered ? cx : 170;
    const maxW = tpl.body.maxWidth;
    const boxH = 1080;
    const y0 = (H - boxH) / 2;

    const fit = fitFontSize(ctx, text, {
      maxWidth: maxW,
      maxHeight: boxH,
      base: tpl.body.size,
      min: 30,
      weight: tpl.body.weight,
      font: tpl.body.font,
      lineHeight: tpl.body.lineHeight,
    });
    const lh = fit.size * tpl.body.lineHeight;
    const totalH = fit.lines.length * lh;
    let y = y0 + (boxH - totalH) / 2;

    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.translate(e.dx, e.dy);

    const reveal = clamp01(p * 1.08); // satırlar ses akışına göre belirir
    const count = fit.lines.length;
    ctx.font = `${tpl.body.weight} ${fit.size}px ${tpl.body.font}, sans-serif`;
    ctx.textAlign = centered ? 'center' : 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = tpl.ink;

    fit.lines.forEach((line, i) => {
      const need = (i + 1) / count;
      const lineP = clamp01((reveal - (i / count)) / (1 / count) * 1.05);
      if (lineP <= 0) return;
      const a = easeOutCubic(lineP);
      const dy = (1 - easeOutCubic(lineP)) * 28;
      ctx.save();
      ctx.globalAlpha = e.alpha * a;
      ctx.fillText(line, x, y + dy);
      ctx.restore();
      y += lh;
    });

    // sol dikey ilerleme çizgisi (sadece soldan hizalı)
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
    ctx.translate(e.dx, e.dy + (e.scale !== 1 ? (1 - e.scale) * H / 2 : 0));
    if (e.scale !== 1) {
      ctx.translate(cx, H / 2);
      ctx.scale(e.scale, e.scale);
      ctx.translate(-cx, -H / 2);
    }

    // başlık
    const title = tpl.decor === 'warm' ? 'Görüşmek dileğiyle' : 'TEŞEKKÜRLER';
    const fit = fitFontSize(ctx, title, {
      maxWidth: 900,
      maxHeight: 300,
      base: tpl.title.uppercase || tpl.decor === 'alert' ? 92 : 84,
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
      ctx.globalAlpha = e.alpha * easeOutCubic(lineP);
      ctx.translate(0, (1 - easeOutCubic(lineP)) * 26);
      ctx.fillText(line, cx, H / 2 - 160 + i * lineH);
      ctx.translate(0, -(1 - easeOutCubic(lineP)) * 26);
    });

    // imza
    ctx.save();
    ctx.globalAlpha = e.alpha * clamp01((p - 0.35) / 0.4);
    ctx.font = `500 44px ${tpl.body.font}, sans-serif`;
    ctx.fillStyle = tpl.muted;
    ctx.textAlign = 'center';
    ctx.fillText(sign, cx, H / 2 + 60);
    ctx.restore();

    // okul adı (altta)
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
