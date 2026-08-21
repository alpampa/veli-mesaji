/* Video tasarım şablonları + duyuru metni şablonları + varsayılanlar */

export const DEFAULT_SETTINGS = {
  schoolName: 'Zeynep Kamil İlkokulu',
  schoolPhone: '',
  schoolAddress: '',
  schoolLogoUrl: null, // dataURL
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

/**
 * Video tasarım şablonları.
 * layout: her sahnenin çizimi renderer.js içinde; buradaki renk/yazı/düzen
 * değerleri o çizimi yönlendirir.
 */
export const VIDEO_TEMPLATES = {
  clean: {
    id: 'clean',
    label: 'Sade',
    desc: 'Minimal, net, okunaklı',
    swatch: ['#FAF9F6', '#16130F', '#E4572E'],
    bg: '#FAF9F6',
    ink: '#16130F',
    muted: '#6E675E',
    accent: '#E4572E',
    surface: 'rgba(22, 19, 15, 0.05)',
    line: 'rgba(22, 19, 15, 0.16)',
    title: {
      font: 'Space Grotesk',
      weight: 800,
      size: 96,
      uppercase: false,
      align: 'left',
      letterSpacing: 0,
      maxWidth: 880,
    },
    body: {
      font: 'Inter',
      weight: 500,
      size: 46,
      lineHeight: 1.55,
      maxWidth: 860,
      align: 'left',
    },
    capsLabel: { font: 'Inter', weight: 600, size: 24, tracking: 3.5 },
    motion: { enter: 'up', exit: 'fade', accentIn: 'draw' },
    decor: 'editorial',
  },

  school: {
    id: 'school',
    label: 'Okul',
    desc: 'Kurumsal okul kimliği',
    swatch: ['#16324F', '#F5EFE2', '#E8B64C'],
    bg: '#16324F',
    ink: '#F5EFE2',
    muted: '#B9C6D4',
    accent: '#E8B64C',
    surface: 'rgba(245, 239, 226, 0.07)',
    line: 'rgba(245, 239, 226, 0.22)',
    title: {
      font: 'Space Grotesk',
      weight: 700,
      size: 84,
      uppercase: true,
      align: 'center',
      letterSpacing: 4,
      maxWidth: 920,
    },
    body: {
      font: 'Inter',
      weight: 400,
      size: 44,
      lineHeight: 1.6,
      maxWidth: 840,
      align: 'center',
    },
    capsLabel: { font: 'Space Grotesk', weight: 600, size: 22, tracking: 5 },
    motion: { enter: 'left', exit: 'fade', accentIn: 'grow' },
    decor: 'institution',
  },

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
    title: {
      font: 'Space Grotesk',
      weight: 700,
      size: 88,
      uppercase: true,
      align: 'center',
      letterSpacing: 2,
      maxWidth: 900,
    },
    body: {
      font: 'Inter',
      weight: 400,
      size: 44,
      lineHeight: 1.6,
      maxWidth: 840,
      align: 'center',
    },
    capsLabel: { font: 'Space Grotesk', weight: 600, size: 22, tracking: 5 },
    motion: { enter: 'scale', exit: 'fade', accentIn: 'grow' },
    decor: 'rings',
  },

  warm: {
    id: 'warm',
    label: 'Sıcak',
    desc: 'Veli iletişimine yakın ton',
    swatch: ['#F6EFE7', '#3E2F23', '#C4552D'],
    bg: '#F6EFE7',
    ink: '#3E2F23',
    muted: '#8A7463',
    accent: '#C4552D',
    surface: 'rgba(62, 47, 35, 0.06)',
    line: 'rgba(62, 47, 35, 0.18)',
    title: {
      font: 'Space Grotesk',
      weight: 700,
      size: 84,
      uppercase: false,
      align: 'center',
      letterSpacing: 0,
      maxWidth: 880,
    },
    body: {
      font: 'Inter',
      weight: 450,
      size: 45,
      lineHeight: 1.58,
      maxWidth: 850,
      align: 'center',
    },
    capsLabel: { font: 'Inter', weight: 600, size: 23, tracking: 4 },
    motion: { enter: 'up', exit: 'fade', accentIn: 'draw' },
    decor: 'arch',
  },

  urgent: {
    id: 'urgent',
    label: 'Acil',
    desc: 'Yüksek öncelikli duyurular',
    swatch: ['#17120F', '#FFFFFF', '#E63946'],
    bg: '#17120F',
    ink: '#FFFFFF',
    muted: '#B8ADA4',
    accent: '#E63946',
    surface: 'rgba(255, 255, 255, 0.06)',
    line: 'rgba(255, 255, 255, 0.24)',
    title: {
      font: 'Space Grotesk',
      weight: 800,
      size: 92,
      uppercase: true,
      align: 'left',
      letterSpacing: 1,
      maxWidth: 900,
    },
    body: {
      font: 'Inter',
      weight: 500,
      size: 46,
      lineHeight: 1.5,
      maxWidth: 860,
      align: 'left',
    },
    capsLabel: { font: 'Space Grotesk', weight: 700, size: 24, tracking: 4 },
    motion: { enter: 'up', exit: 'fade', accentIn: 'draw' },
    decor: 'alert',
  },
};

export const TEMPLATE_ORDER = ['clean', 'school', 'event', 'warm', 'urgent'];

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
