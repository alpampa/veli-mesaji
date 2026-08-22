/* Taslak deposu — IndexedDB (ses dosyası dahil), yoksa bellek yedeği.
 *
 * Arayüz: save(draft) -> id · list() -> özetler · get(id) -> tam kayıt · del(id)
 * draft: { id?, name, createdAt?, updatedAt?, title, fields, templateId,
 *          sameCheck, scenes, audio?, audioBlob? }
 */

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'd' + Date.now() + Math.random().toString(36).slice(2, 10);
}

class MemoryStore {
  constructor() {
    this.m = new Map();
  }
  async save(draft) {
    draft.id = draft.id || newId();
    draft.updatedAt = Date.now();
    if (!draft.createdAt) draft.createdAt = draft.updatedAt;
    this.m.set(draft.id, draft);
    return draft.id;
  }
  async list() {
    return [...this.m.values()].map(({ id, name, createdAt, updatedAt, title }) => ({ id, name, createdAt, updatedAt, title }));
  }
  async get(id) {
    return this.m.get(id) || null;
  }
  async del(id) {
    this.m.delete(id);
  }
}

class IDBStore {
  constructor(db) {
    this.db = db;
    this._ready = this._open();
  }
  _open() {
    return new Promise((resolve, reject) => {
      const req = this.db.open('veli-mesaji-drafts', 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('drafts')) d.createObjectStore('drafts', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async _store(mode) {
    const db = await this._ready;
    return db.transaction('drafts', mode).objectStore('drafts');
  }
  async save(draft) {
    const st = await this._store('readwrite');
    draft.id = draft.id || newId();
    draft.updatedAt = Date.now();
    if (!draft.createdAt) draft.createdAt = draft.updatedAt;
    await new Promise((resolve, reject) => {
      const r = st.put(draft);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
    return draft.id;
  }
  async list() {
    const st = await this._store('readonly');
    return new Promise((resolve, reject) => {
      const r = st.getAll();
      r.onsuccess = () =>
        resolve((r.result || []).map(({ id, name, createdAt, updatedAt, title }) => ({ id, name, createdAt, updatedAt, title })));
      r.onerror = () => reject(r.error);
    });
  }
  async get(id) {
    const st = await this._store('readonly');
    return new Promise((resolve, reject) => {
      const r = st.get(id);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  }
  async del(id) {
    const st = await this._store('readwrite');
    return new Promise((resolve, reject) => {
      const r = st.delete(id);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  }
}

export function createDraftStore() {
  const db = typeof indexedDB !== 'undefined' ? indexedDB : null;
  return db ? new IDBStore(db) : new MemoryStore();
}
