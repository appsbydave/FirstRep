/* FIRST REP — storage.
 * IndexedDB, no dependencies. History is an append-only event log, partitioned
 * by profileId. Derived state is never stored — it is recomputed from events,
 * which makes engine fixes retroactive and makes any future sync a set union.
 */

const DB_NAME = 'firstrep';
const DB_VERSION = 1;
let _db = null;

export function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = ev => {
      const db = req.result;
      if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('events')) {
        const s = db.createObjectStore('events', { keyPath: 'eventId' });
        s.createIndex('byProfile', 'profileId');
      }
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
      void ev;
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode = 'readonly') {
  return open().then(db => db.transaction(store, mode).objectStore(store));
}
const wrap = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export const put = (store, value) => tx(store, 'readwrite').then(s => wrap(s.put(value)));
export const get = (store, key) => tx(store).then(s => wrap(s.get(key)));
export const all = store => tx(store).then(s => wrap(s.getAll()));
export const del = (store, key) => tx(store, 'readwrite').then(s => wrap(s.delete(key)));

/* ── kv helpers ───────────────────────────────────────────────────────────── */
export const setKV = (key, value) => put('kv', { key, value });
export const getKV = async (key, fallback = null) => (await get('kv', key))?.value ?? fallback;

/* ── events ───────────────────────────────────────────────────────────────── */
export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function append(profileId, type, payload) {
  const event = {
    eventId: uuid(), profileId, type, payload,
    occurredAt: new Date().toISOString(),
    deviceId: await deviceId(), v: 1
  };
  await put('events', event);
  return event;
}

export async function eventsFor(profileId) {
  const s = await tx('events');
  const idx = s.index('byProfile');
  const list = await wrap(idx.getAll(profileId));
  return list.sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));
}

export async function deviceId() {
  let id = await getKV('deviceId');
  if (!id) { id = uuid(); await setKV('deviceId', id); }
  return id;
}

/* ── profiles ─────────────────────────────────────────────────────────────── */
export async function createProfile(name) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const profile = {
    id: uuid(), name: name.trim(), initials, createdAt: new Date().toISOString(),
    screening: null, bodyweightKg: null, suppressBody: false, fatLoss: false, track: 'standard'
  };
  await put('profiles', profile);
  return profile;
}

export const profiles = () => all('profiles').then(p => p.sort((a, b) => a.createdAt < b.createdAt ? -1 : 1));

export async function deleteProfile(id) {
  const evs = await eventsFor(id);
  await Promise.all(evs.map(e => del('events', e.eventId)));
  await del('profiles', id);
}

/* ── device (the bar lives on the device, bodyweight lives on the person) ─── */
export const getDevice = () => getKV('device', { barType: null, barRatingKg: null, spaceOk: null });
export const setDevice = d => setKV('device', d);

/* ── export ───────────────────────────────────────────────────────────────── */
export async function exportAll() {
  return {
    app: 'First Rep', exportedAt: new Date().toISOString(), schema: DB_VERSION,
    device: await getDevice(), profiles: await profiles(), events: await all('events')
  };
}

/* Storage on iOS can be evicted. Ask for persistence, and report honestly. */
export async function requestPersistence() {
  if (!navigator.storage?.persist) return { supported: false, granted: false };
  const already = await navigator.storage.persisted?.();
  if (already) return { supported: true, granted: true };
  return { supported: true, granted: await navigator.storage.persist() };
}
