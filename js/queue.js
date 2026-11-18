// Tiny IndexedDB outbox for scans taken while offline.
// Photos are base64 strings already, so a job is plain structured-clone data.

const DB_NAME = "leafdoc";
const STORE = "outbox";
const VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Could not open the offline queue"));
  });
}

function run(mode, action) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let request;
    try {
      request = action(store);
    } catch (err) {
      db.close();
      reject(err);
      return;
    }
    t.oncomplete = () => {
      db.close();
      resolve(request ? request.result : undefined);
    };
    t.onerror = () => {
      db.close();
      reject(t.error || new Error("Offline queue failed"));
    };
  }));
}

export function queueAll() {
  return run("readonly", (s) => s.getAll())
    .then((rows) => (Array.isArray(rows) ? rows : []).sort((a, b) => a.ts - b.ts));
}

export function queueCount() {
  return run("readonly", (s) => s.count()).then((n) => Number(n) || 0);
}

export function queueRemove(id) {
  return run("readwrite", (s) => s.delete(id));
}

// Adds a job and keeps the queue short, dropping the oldest beyond `max`.
export async function queueAdd(job, max = 2) {
  await run("readwrite", (s) => s.put(job));
  const rows = await queueAll();
  if (max && rows.length > max) {
    for (const old of rows.slice(0, rows.length - max)) await queueRemove(old.id);
  }
  return Math.min(rows.length, max || rows.length);
}
