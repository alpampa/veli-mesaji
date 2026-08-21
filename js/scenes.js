/* Sahne motoru: ses süresine göre sahneleri otomatik dağıtır */

export const SCENE_MIN = { intro: 2.5, title: 3, date: 2.5, message: 5, outro: 2.5 };
export const SCENE_WEIGHT = { intro: 0.1, title: 0.16, date: 0.14, message: 0.46, outro: 0.14 };

export const SCENE_LABEL = {
  intro: 'INTRO',
  title: 'TITLE',
  date: 'DATE',
  message: 'MESSAGE',
  outro: 'OUTRO',
};

/**
 * Ses süresine göre sahne dağılımı üretir.
 * @param {number} audioDuration ses süresi (sn)
 * @param {{hasDate:boolean, hasBody:boolean}} opts
 * @returns {{scenes:Array<{type:string,start:number,end:number,dur:number}>, videoDuration:number}}
 */
export function buildScenes(audioDuration, { hasDate = true, hasBody = true } = {}) {
  const D = Math.max(2, audioDuration || 10);
  const kinds = [
    { type: 'intro' },
    { type: 'title' },
    { type: 'date', skip: !hasDate },
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
  // 2) kalan, ağırlıklara göre
  if (remaining > 0) {
    kinds.forEach((k) => {
      alloc[k.type] += remaining * (SCENE_WEIGHT[k.type] / wsum);
    });
  }
  // 3) tam D'ye normalize et
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
    scenes.push({ type: k.type, start: t, end: t + dur, dur });
    t += dur;
  });

  return { scenes, videoDuration: t };
}

/** Belirli bir andaki sahneyi döndürür */
export function sceneAt(scenes, t) {
  return scenes.find((s) => t >= s.start && t < s.end) || null;
}
