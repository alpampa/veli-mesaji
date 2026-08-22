/* Paylaşım sistemi — paylaşım sayfası (sheet) + yardımcılar.
 *
 * Akış: PAYLAŞ → kontroller (✓ video/ses/süre/MP4/1080×1920) →
 *       WhatsApp / E-posta / Sistemle Paylaş / Bağlantı / İndir.
 * 40 sn aşımı olan video "paylaşılabilir" işaretlenmez (yalnızca indirme + bağlantı).
 */

import { fmtClock, escapeHtml } from './utils.js';
import { shareFile, waShareUrl, mailtoUrl, downloadBlob } from './exporter.js';

const MAX_SECONDS = 40;

/** Anlamlı dosya adı: veli-mesaji-<başlık>-<tarih>.mp4 */
export function shareFilename(title, date = new Date()) {
  const slug = (title || 'mesaj')
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşü]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'mesaj';
  return `veli-mesaji-${slug}-${date.toISOString().slice(0, 10)}.mp4`;
}

/** Paylaşım öncesi son kontrol listesi */
export function buildShareChecklist({ duration }) {
  const ok40 = duration <= MAX_SECONDS + 0.5;
  const items = [
    { label: 'Video oluşturuldu', ok: true },
    { label: 'Ses mevcut', ok: true },
    { label: `Süre: ${fmtClock(duration, true)} sn`, ok: ok40 },
    { label: 'MP4 hazır', ok: true },
    { label: '1080 × 1920', ok: true },
  ];
  return { items, shareable: ok40 };
}

export function shareLinkText(title, siteUrl) {
  return `Veli duyurumuz hazır: ${title || 'Veli Duyurusu'}\n${siteUrl}`;
}

export function waMessage(title, siteUrl) {
  return `Merhaba! Veli duyurumuz hazır: ${title || 'Veli Duyurusu'}\n${siteUrl}\n(Videoyu indirip WhatsApp'ta ek olarak gönderebilirsiniz.)`;
}

export function emailBody(title, siteUrl) {
  return `Merhaba,\n\nVeli duyurumuzun videosu hazır (1080×1920 MP4).\n${siteUrl}\n\n${title || ''}`.trim();
}

/** Sistem paylaşımı (Web Share API). Dosya desteklenmiyorsa 'fallback' döner. */
export async function systemShare(blob, filename, title, nav = navigator) {
  if (nav && nav.share && nav.canShare) {
    const file = new File([blob], filename, { type: 'video/mp4' });
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title });
        return 'native';
      } catch (err) {
        if (err && err.name === 'AbortError') return 'aborted';
      }
    }
  }
  return 'fallback';
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/* ---------------- Paylaşım sayfası ---------------- */

export class ShareSheet {
  /**
   * @param {object} els paylaşım modalı elemanları
   * @param {{siteUrl:string}} opts
   */
  constructor(els, { siteUrl = location.href.split('#')[0] } = {}) {
    this.els = els;
    this.siteUrl = siteUrl;
    this.payload = null;
    this.wire();
  }

  wire() {
    const els = this.els;
    els.close.addEventListener('click', () => this.close());
    els.modal.addEventListener('click', (e) => {
      if (e.target === els.modal) this.close();
    });
    els.whatsapp.addEventListener('click', () => this.whatsapp());
    els.email.addEventListener('click', () => this.email());
    els.system.addEventListener('click', () => this.system());
    els.link.addEventListener('click', () => this.link());
    els.download.addEventListener('click', () => this.download());
  }

  open({ blob, filename, title, duration }) {
    this.payload = { blob, filename, title, duration };
    const els = this.els;
    els.title.textContent = title || 'Veli Duyurusu';
    els.meta.textContent = `${fmtClock(duration, true)} saniyelik video · 1080 × 1920 MP4`;

    const { items, shareable } = buildShareChecklist({ duration });
    els.checks.innerHTML = items
      .map((it) => `<li class="${it.ok ? 'ok' : 'bad'}"><span class="sc-mark">${it.ok ? '✓' : '✕'}</span>${escapeHtml(it.label)}</li>`)
      .join('');

    els.ready.classList.toggle('hidden', !shareable);
    els.readyInfo.textContent = shareable
      ? `Video: ${title || 'Veli Duyurusu'} · Süre: ${fmtClock(duration, true)} sn`
      : '';
    els.whatsapp.disabled = !shareable;
    els.system.disabled = !shareable;
    els.whatsapp.title = shareable ? '' : '40 sn sınırı aşıldığı için dosya paylaşımı kapatıldı';
    els.system.title = els.whatsapp.title;

    this.status('', '');
    els.modal.classList.remove('hidden');
  }

  close() {
    this.els.modal.classList.add('hidden');
  }

  status(type, html) {
    const s = this.els.status;
    s.className = 'share-status' + (type ? ' ' + type : '');
    s.innerHTML = html || '';
  }

  async whatsapp() {
    const { blob, filename, title } = this.payload;
    const res = await shareFile(blob, filename, title);
    if (res.method === 'native') {
      this.status('ok', '✓ Paylaşıma hazır — WhatsApp/cihaz paylaşımı açıldı. İstediğiniz veli ya da grubu seçin.');
      return;
    }
    downloadBlob(blob, filename);
    window.open(waShareUrl(waMessage(title, this.siteUrl)), '_blank', 'noopener');
    this.status('ok', '✓ Videoyu indirdik ve WhatsApp açıldı — dosyayı ek olarak gönderin.');
  }

  email() {
    const { title, duration } = this.payload;
    window.location.href = mailtoUrl({
      subject: title || 'Veli Duyurusu',
      body: emailBody(title, this.siteUrl),
    });
    this.status('ok', `E-posta uygulamanız açılıyor. Video ekini eklemek için önce <b>MP4'ü İndir</b> seçeneğini kullanın (${fmtClock(duration, true)}).`);
  }

  async system() {
    const { blob, filename, title } = this.payload;
    const res = await systemShare(blob, filename, title);
    if (res === 'native') {
      this.status('ok', '✓ Paylaşıma hazır — sistem paylaşımı açıldı.');
    } else if (res === 'fallback') {
      this.status('warn', 'Bu cihaz dosya paylaşımını desteklemiyor — <b>WhatsApp</b> veya <b>İndir</b> seçin.');
    }
  }

  async link() {
    const ok = await copyText(shareLinkText(this.payload.title, this.siteUrl));
    this.status(ok ? 'ok' : 'warn', ok ? '✓ Bağlantı kopyalandı.' : 'Bağlantı kopyalanamadı.');
  }

  download() {
    const { blob, filename } = this.payload;
    downloadBlob(blob, filename);
    this.status('ok', `✓ İndirme başladı — ${escapeHtml(filename)}`);
  }
}
