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
  /* ---------- CINEMATIC: geniş perspektif, atmosferik derinlik ---------- */
  cinematic: {
    id: 'cinematic',
    label: 'Sinematik',
    desc: 'Geniş atmosfer, editoryal tipografi',
    swatch: ['#0B1016', '#1C2A33', '#F2B544'],
    bg: '#0B1016',
    ink: '#F5EFE4',
    muted: '#A9B4BE',
    accent: '#F2B544',
    surface: 'rgba(245, 239, 228, 0.07)',
    line: 'rgba(245, 239, 228, 0.22)',
    title: { font: 'Space Grotesk', weight: 800, size: 92, uppercase: true, align: 'center', letterSpacing: 3, maxWidth: 940 },
    body: { font: 'Inter', weight: 400, size: 42, lineHeight: 1.62, maxWidth: 860, align: 'center' },
    capsLabel: { font: 'Space Grotesk', weight: 600, size: 22, tracking: 6 },
    motion: { enter: 'up', exit: 'fade', accentIn: 'draw' },
    decor: 'cinematic',
    background: 'cinematic',
    camera: { push: 0.028, driftX: 14, driftY: 6 },   // yavaş kamera ilerlemesi + sürüklenme
    transition: 'dissolve',
    layout: { titleY: 720, messageBox: 1080, centered: true },
  },

  /* ---------- EDITORIAL: dergi/magazin dili ---------- */
  editorial: {
    id: 'editorial',
    label: 'Editoryal',
    desc: 'Dergi tipografisi, güçlü kontrast',
    swatch: ['#F7F5F0', '#171310', '#C0392B'],
    bg: '#F7F5F0',
    ink: '#171310',
    muted: '#7A736A',
    accent: '#C0392B',
    surface: 'rgba(23, 19, 16, 0.05)',
    line: 'rgba(23, 19, 16, 0.2)',
    title: { font: 'Space Grotesk', weight: 800, size: 104, uppercase: false, align: 'left', letterSpacing: -1, maxWidth: 900 },
    body: { font: 'Inter', weight: 450, size: 44, lineHeight: 1.5, maxWidth: 880, align: 'left' },
    capsLabel: { font: 'Inter', weight: 700, size: 22, tracking: 5 },
    motion: { enter: 'left', exit: 'fade', accentIn: 'draw' },
    decor: 'editorial',
    background: 'editorial',
    camera: { push: 0.012, driftX: 0, driftY: 0 },
    transition: 'wipe',
    layout: { titleY: 640, messageBox: 1040, centered: false },
  },

  /* ---------- MODERN: koyu, geometrik, teknolojik ---------- */
  modern: {
    id: 'modern',
    label: 'Modern',
    desc: 'Koyu zemin, geometrik vurgular',
    swatch: ['#12151B', '#0E7C6B', '#E8B44C'],
    bg: '#12151B',
    ink: '#F2F4F6',
    muted: '#9AA3AE',
    accent: '#E8B44C',
    surface: 'rgba(242, 244, 246, 0.06)',
    line: 'rgba(242, 244, 246, 0.18)',
    title: { font: 'Space Grotesk', weight: 700, size: 88, uppercase: true, align: 'center', letterSpacing: 5, maxWidth: 920 },
    body: { font: 'Inter', weight: 400, size: 43, lineHeight: 1.58, maxWidth: 860, align: 'center' },
    capsLabel: { font: 'Space Grotesk', weight: 600, size: 22, tracking: 6 },
    motion: { enter: 'scale', exit: 'fade', accentIn: 'grow' },
    decor: 'modern',
    background: 'modern',
    camera: { push: 0.02, driftX: 0, driftY: -8 },
    transition: 'dissolve',
    layout: { titleY: 700, messageBox: 1040, centered: true },
  },

  /* ---------- WARM SCHOOL: veli iletişimi + okul kimliği ---------- */
  warm: {
    id: 'warm',
    label: 'Sıcak Okul',
    desc: 'Sıcak ton, okul kimliği',
    swatch: ['#F6EFE7', '#3E2F23', '#C4552D'],
    bg: '#F6EFE7',
    ink: '#3E2F23',
    muted: '#8A7463',
    accent: '#C4552D',
    surface: 'rgba(62, 47, 35, 0.06)',
    line: 'rgba(62, 47, 35, 0.18)',
    title: { font: 'Space Grotesk', weight: 700, size: 84, uppercase: false, align: 'center', letterSpacing: 0, maxWidth: 880 },
    body: { font: 'Inter', weight: 450, size: 45, lineHeight: 1.58, maxWidth: 850, align: 'center' },
    capsLabel: { font: 'Inter', weight: 600, size: 23, tracking: 4 },
    motion: { enter: 'up', exit: 'fade', accentIn: 'draw' },
    decor: 'arch',
    background: 'warm',
    camera: { push: 0.016, driftX: 0, driftY: 4 },
    transition: 'fade',
    layout: { titleY: 720, messageBox: 1060, centered: true },
  },

  /* ---------- EVENT: kutlama / organizasyon ---------- */
  event: {
    id: 'event',
    label: 'Etkinlik',
    desc: 'Kutlama ve organizasyonlar',
    swatch: ['#223D36', '#F7F1E3', '#E9B44C'],
    bg: '#223D36',
    ink: '#F7F1E3',
    muted: '#B7C6BF',
    accent: '#E9B44C',
    surface: 'rgba(247, 241, 227, 0.07)',
    line: 'rgba(247, 241, 227, 0.22)',
    title: { font: 'Space Grotesk', weight: 700, size: 88, uppercase: true, align: 'center', letterSpacing: 2, maxWidth: 900 },
    body: { font: 'Inter', weight: 400, size: 44, lineHeight: 1.6, maxWidth: 840, align: 'center' },
    capsLabel: { font: 'Space Grotesk', weight: 600, size: 22, tracking: 5 },
    motion: { enter: 'scale', exit: 'fade', accentIn: 'grow' },
    decor: 'rings',
    background: 'rings',
    camera: { push: 0.02, driftX: 0, driftY: 0 },
    transition: 'fade',
    layout: { titleY: 700, messageBox: 1040, centered: true },
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
