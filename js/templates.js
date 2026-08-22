/* Video tasarım şablonları + duyuru metni şablonları + varsayılanlar
 *
 * Her şablon: renk sistemi, tipografi, sahne yerleşimi, arka plan,
 * kamera hareketi ve geçiş dilini tanımlar.
 */

export const DEFAULT_SETTINGS = {
  schoolName: 'Zeynep Kamil İlkokulu',
  schoolPhone: '',
  schoolAddress: '',
  schoolLogoUrl: null, // dataURL
  ttsUrl: '', // TTS sunucusu (boşsa otomatik bul)
  ttsAuto: true,
  apiKey: '', // opsiyonel: backend X-API-Key (JS'e gömülmez, kullanıcı girer)
};

export const DEFAULT_FIELDS = {
  school: 'Zeynep Kamil İlkokulu',
  title: 'VELİ TOPLANTISI',
  date: '25 EYLÜL',
  time: '14:30',
  location: 'Okul Konferans Salonu',
  body: 'Değerli velilerimiz, çocuklarımızın gelişimini birlikte konuşmak için veli toplantımıza hepinizi bekliyoruz.\nKatılımınız bizim için çok değerli. Sorularınız için bizi okul numaramızdan arayabilirsiniz.\nGörüşmek dileğiyle.',
  sign: 'Sınıf Öğretmeni Ayşe Yılmaz',
};

/** İlk açılışta preview'da gösterilen sinematik demo sahne içeriği */
export const DEMO_FIELDS = {
  school: 'Zeynep Kamil İlkokulu',
  title: 'VELİ TOPLANTISI',
  date: '25 EYLÜL',
  time: '14:30',
  location: 'Okul Konferans Salonu',
  body: 'Değerli velilerimiz, çocuklarımızın gelişimini birlikte konuşmak için toplantımıza hepinizi bekliyoruz.\nKatılımınız bizim için çok değerli.\nGörüşmek dileğiyle.',
  sign: 'Sınıf Öğretmeni Ayşe Yılmaz',
};

export const VIDEO_TEMPLATES = {
  /* ---------- CINEMATIC: açık gök, geniş perspektif, editoryal tipografi ---------- */
  cinematic: {
    id: 'cinematic',
    label: 'Sinematik',
    desc: 'Açık gök, editoryal tipografi',
    swatch: ['#E8F1FB', '#16324F', '#F2A93B'],
    bg: '#E8F1FB',
    ink: '#16324F',
    muted: '#5E7A93',
    accent: '#F2A93B',
    surface: 'rgba(22, 50, 79, 0.05)',
    line: 'rgba(22, 50, 79, 0.16)',
    title: { font: 'Space Grotesk', weight: 800, size: 92, uppercase: true, align: 'center', letterSpacing: 3, maxWidth: 840 },
    body: { font: 'Inter', weight: 500, size: 44, lineHeight: 1.5, maxWidth: 840, align: 'center' },
    capsLabel: { font: 'Space Grotesk', weight: 600, size: 22, tracking: 6 },
    motion: { enter: 'up', exit: 'fade', accentIn: 'draw' },
    decor: 'cinematic',
    background: 'cinematic',
    camera: { push: 0.02, driftX: 12, driftY: 4 },   // yavaş kamera + paralaks (yalnızca dekor)
    transition: 'dissolve',
    layout: { titleY: 720, messageBox: 1060, centered: true },
  },

  /* ---------- EDITORIAL: beyaz dergi dili, güçlü kontrast ---------- */
  editorial: {
    id: 'editorial',
    label: 'Editoryal',
    desc: 'Dergi tipografisi, net kontrast',
    swatch: ['#FFFFFF', '#12294A', '#2F6FE0'],
    bg: '#FFFFFF',
    ink: '#12294A',
    muted: '#5F7891',
    accent: '#2F6FE0',
    surface: 'rgba(18, 41, 74, 0.05)',
    line: 'rgba(18, 41, 74, 0.16)',
    title: { font: 'Space Grotesk', weight: 800, size: 96, uppercase: false, align: 'left', letterSpacing: -1, maxWidth: 810 },
    body: { font: 'Inter', weight: 450, size: 44, lineHeight: 1.5, maxWidth: 810, align: 'left' },
    capsLabel: { font: 'Inter', weight: 700, size: 22, tracking: 5 },
    motion: { enter: 'left', exit: 'fade', accentIn: 'draw' },
    decor: 'editorial',
    background: 'editorial',
    camera: { push: 0.01, driftX: 0, driftY: 0 },
    transition: 'wipe',
    layout: { titleY: 640, messageBox: 1060, centered: false },
  },

  /* ---------- MODERN: açık mavi, geometrik vurgular ---------- */
  modern: {
    id: 'modern',
    label: 'Modern',
    desc: 'Açık zemin, geometrik vurgular',
    swatch: ['#EAF2FB', '#132A44', '#14939A'],
    bg: '#EAF2FB',
    ink: '#132A44',
    muted: '#5F7891',
    accent: '#14939A',
    surface: 'rgba(19, 42, 68, 0.05)',
    line: 'rgba(19, 42, 68, 0.14)',
    title: { font: 'Space Grotesk', weight: 700, size: 88, uppercase: true, align: 'center', letterSpacing: 4, maxWidth: 840 },
    body: { font: 'Inter', weight: 500, size: 43, lineHeight: 1.52, maxWidth: 840, align: 'center' },
    capsLabel: { font: 'Space Grotesk', weight: 600, size: 22, tracking: 6 },
    motion: { enter: 'scale', exit: 'fade', accentIn: 'grow' },
    decor: 'modern',
    background: 'modern',
    camera: { push: 0.016, driftX: 0, driftY: -6 },
    transition: 'dissolve',
    layout: { titleY: 700, messageBox: 1060, centered: true },
  },

  /* ---------- WARM SCHOOL: sıcak krem + okul kimliği ---------- */
  warm: {
    id: 'warm',
    label: 'Sıcak Okul',
    desc: 'Sıcak ton, okul kimliği',
    swatch: ['#FBF6EF', '#2E4A66', '#E8A33D'],
    bg: '#FBF6EF',
    ink: '#2E4A66',
    muted: '#7A8CA3',
    accent: '#E8A33D',
    surface: 'rgba(46, 74, 102, 0.06)',
    line: 'rgba(46, 74, 102, 0.16)',
    title: { font: 'Space Grotesk', weight: 700, size: 84, uppercase: false, align: 'center', letterSpacing: 0, maxWidth: 840 },
    body: { font: 'Inter', weight: 500, size: 45, lineHeight: 1.52, maxWidth: 840, align: 'center' },
    capsLabel: { font: 'Inter', weight: 600, size: 23, tracking: 4 },
    motion: { enter: 'up', exit: 'fade', accentIn: 'draw' },
    decor: 'arch',
    background: 'warm',
    camera: { push: 0.014, driftX: 0, driftY: 4 },
    transition: 'fade',
    layout: { titleY: 720, messageBox: 1060, centered: true },
  },

  /* ---------- EVENT: açık camgöbeği, kutlama / organizasyon ---------- */
  event: {
    id: 'event',
    label: 'Etkinlik',
    desc: 'Kutlama ve organizasyonlar',
    swatch: ['#E7F3F4', '#123F44', '#F2B544'],
    bg: '#E7F3F4',
    ink: '#123F44',
    muted: '#6E8A8F',
    accent: '#F2B544',
    surface: 'rgba(18, 63, 68, 0.05)',
    line: 'rgba(18, 63, 68, 0.16)',
    title: { font: 'Space Grotesk', weight: 700, size: 88, uppercase: true, align: 'center', letterSpacing: 2, maxWidth: 840 },
    body: { font: 'Inter', weight: 500, size: 44, lineHeight: 1.55, maxWidth: 840, align: 'center' },
    capsLabel: { font: 'Space Grotesk', weight: 600, size: 22, tracking: 5 },
    motion: { enter: 'scale', exit: 'fade', accentIn: 'grow' },
    decor: 'rings',
    background: 'rings',
    camera: { push: 0.016, driftX: 0, driftY: 0 },
    transition: 'fade',
    layout: { titleY: 700, messageBox: 1060, centered: true },
  },
};

export const TEMPLATE_ORDER = ['cinematic', 'editorial', 'modern', 'warm', 'event'];

/** Duyuru metni şablonları (sol panel) */
export const MESSAGE_TEMPLATES = [
  {
    label: 'Toplantı',
    icon: '🗓',
    fields: {
      school: '',
      title: 'VELİ TOPLANTISI',
      date: '25 EYLÜL',
      time: '14:30',
      location: 'Okul Konferans Salonu',
      body: 'Değerli velilerimiz, çocuklarımızın gelişimini birlikte konuşmak için veli toplantımıza hepinizi bekliyoruz.\nKatılımınız bizim için çok değerli. Sorularınız için bizi okul numaramızdan arayabilirsiniz.\nGörüşmek dileğiyle.',
      sign: 'Sınıf Öğretmeni Ayşe Yılmaz',
    },
  },
  {
    label: 'Ödev',
    icon: '📚',
    fields: {
      school: '',
      title: 'HAFTALIK ÖDEVLER',
      date: 'HER PAZARTESİ',
      time: '',
      location: '',
      body: 'Haftalık ödevlerimiz her pazartesi günü e-okul sistemine yükleniyor.\nÖdevlerin takibi için her akşam 15 dakika ayırmanızı rica ediyoruz.\nZorlanan öğrenciler için çarşamba günleri 14.00 – 15.00 arası okulumuzda destek çalışması yapıyoruz.',
      sign: '4-A Sınıf Öğretmeni',
    },
  },
  {
    label: 'Gezi',
    icon: '🚌',
    fields: {
      school: '',
      title: 'OKUL GEZİSİ',
      date: '4 EKİM CUMA',
      time: '09:00',
      location: 'Doğa Bilimleri Müzesi',
      body: '4 Ekim Cuma günü doğa bilimleri müzesine okul gezisi düzenliyoruz.\nKatılım için izin belgesini en geç 30 Eylül Pazartesi gününe kadar sınıf öğretmenine teslim edin.\nGezi ücreti 350 TL olup ayrıntılar izin belgesinde yazmaktadır.',
      sign: 'Okul Yönetimi',
    },
  },
  {
    label: 'Duyuru',
    icon: '📢',
    fields: {
      school: '',
      title: 'ÖNEMLİ DUYURU',
      date: 'YARIN',
      time: '10:00',
      location: '',
      body: 'Yarın okulumuzda planlı elektrik çalışması yapılacağı için dersler saat 10.00’da başlayacak.\nTüm öğrencilerimizin 10.00’a kadar okulda olması gerekmektedir.\nAnlayışınız için teşekkür ederiz.',
      sign: 'Okul İdaresi',
    },
  },
];
