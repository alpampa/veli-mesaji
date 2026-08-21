/* Sahne motoru: ses süresine göre sahneleri otomatik dağıtır.
 *
 * Sahne tipleri: intro, title, date, time, location, message, outro
 * (date/time/location yalnızca ilgili alan doluysa eklenir)
 */

export const SCENE_MIN = {
  intro: 2.5, title: 3, date: 2.5, time: 2.5, location: 3, message: 6, outro: 3,
};

export const SCENE_WEIGHT = {
  intro: 0.08, title: 0.14, date: 0.1, time: 0.1, location: 0.12, message: 0.34, outro: 0.12,
};

export const SCENE_LABEL = {
  intro: 'INTRO',
  title: 'TITLE',
  date: 'DATE',
  time: 'TIME',
  location: 'PLACE',
  message: 'MESSAGE',
  outro: 'OUTRO',
};

export const SCENE_ANIMATION = {
  intro: 'fade-scale',
  title: 'slide-up',
  date: 'soft-reveal',
  time: 'soft-reveal',
  location: 'slide-left',
  message: 'line-reveal',
  outro: 'fade-out',
};

/**
 * Ses süresine göre sahne dağılımı üretir.
 * @param {number} audioDuration ses süresi (sn)
 * @param {{hasDate:boolean, hasTime:boolean, hasLocation:boolean, hasBody:boolean}} opts
 * @returns {{scenes:Array<{id:string,type:string,start:number,end:number,dur:number,animation:string}>, videoDuration:number}}
 */
export function buildScenes(audioDuration, { hasDate = false, hasTime = false, hasLocation = false, hasBody = false } = {}) {
  const D = Math.max(2, audioDuration || 10);
  const kinds = [
    { type: 'intro' },
    { type: 'title' },
    { type: 'date', skip: !hasDate },
    { type: 'time', skip: !hasTime },
    { type: 'location', skip: !hasLocation },
    { type: 'message', skip: !hasBody },
    { type: 'outro' },
  ].filter((k) => !k.skip);

  const alloc = {};
  let remaining = D;
  const wsum = kinds.reduce((a, k) => a + SCENE_WEIGHT[k.type], 0);

  // 1) minimumlar
  kinds.forEach((k) => {
    alloc[k.type] = Math.min(SCENE_MIN[k.type], D);
    remaining -= alloc[k.type];
  });
  // 2) kalan ağırlıklara göre
  if (remaining > 0) {
    kinds.forEach((k) => {
      alloc[k.type] += remaining * (SCENE_WEIGHT[k.type] / wsum);
    });
  }
  // 3) tam D'ye normalize
  const sum = kinds.reduce((a, k) => a + alloc[k.type], 0);
  kinds.forEach((k) => {
    alloc[k.type] = (alloc[k.type] / sum) * D;
  });

  // 4) sahne listesi + bitiş kuyruğu
  const tail = 0.7;
  const scenes = [];
  let t = 0;
  kinds.forEach((k, i) => {
    let dur = alloc[k.type];
    if (i === kinds.length - 1) dur += tail;
    scenes.push({
      id: k.type,
      type: k.type,
      start: t,
      end: t + dur,
      dur,
      animation: SCENE_ANIMATION[k.type] || 'fade',
    });
    t += dur;
  });

  return { scenes, videoDuration: t };
}

/** Belirli bir andaki sahneyi döndürür */
export function sceneAt(scenes, t) {
  return scenes.find((s) => t >= s.start && t < s.end) || null;
}
