/* ══════════════════════════════════════════════════════════════
   Local drafts.

   Notes are edited in the browser and synced to the server on an
   800 ms debounce. If the network drops — or the tab is closed —
   that keystroke would otherwise be lost, so every second we write
   the working copy to IndexedDB and restore it on the next visit.

   IndexedDB is used rather than localStorage because a note body can
   comfortably be a few hundred kilobytes, and localStorage is
   synchronous and capped at ~5 MB for the whole origin.
   ══════════════════════════════════════════════════════════════ */

const DB_NAME = 'shelf-drafts'
const DB_VERSION = 1
const STORE = 'drafts'

export interface NoteDraft {
  noteId: string
  title: string
  body_md: string
  /** Epoch ms of the last local edit. */
  savedAt: number
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'noteId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
  return dbPromise
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE)
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Persist the working copy of a note. Failures are not fatal. */
export async function saveDraft(draft: NoteDraft): Promise<void> {
  try {
    const db = await openDb()
    if (!db) return
    await wrap(tx(db, 'readwrite').put(draft))
  } catch {
    /* Storage may be full or blocked — the server copy is still safe. */
  }
}

/** Read back the working copy of a note, if there is one. */
export async function loadDraft(noteId: string): Promise<NoteDraft | null> {
  try {
    const db = await openDb()
    if (!db) return null
    const value = await wrap<NoteDraft | undefined>(tx(db, 'readonly').get(noteId))
    return value ?? null
  } catch {
    return null
  }
}

/** Forget the working copy once it has been saved to the server. */
export async function clearDraft(noteId: string): Promise<void> {
  try {
    const db = await openDb()
    if (!db) return
    await wrap(tx(db, 'readwrite').delete(noteId))
  } catch {
    /* ignore */
  }
}

/** Drop every stored draft (used by "delete account" and sign-out). */
export async function clearAllDrafts(): Promise<void> {
  try {
    const db = await openDb()
    if (!db) return
    await wrap(tx(db, 'readwrite').clear())
  } catch {
    /* ignore */
  }
}
