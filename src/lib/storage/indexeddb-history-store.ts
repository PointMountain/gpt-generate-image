import { MAX_HISTORY_ITEMS, trimHistoryEntries } from '../../features/history/history-retention';
import type { HistoryEntry } from '../../features/history/history-types';

const DB_NAME = 'gpt-image-workbench-history';
const STORE_NAME = 'history';
const DB_VERSION = 1;

function openHistoryDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => void,
): Promise<T> {
  const database = await openHistoryDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      database.close();
    };

    callback(store);

    store.transaction.oncomplete = () => {
      resolve(undefined as T);
    };
  });
}

export async function listHistoryEntries(): Promise<HistoryEntry[]> {
  const database = await openHistoryDatabase();

  return new Promise<HistoryEntry[]>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const entries = trimHistoryEntries((request.result as HistoryEntry[]) ?? []);
      database.close();
      resolve(entries);
    };
  });
}

export async function putHistoryEntry(entry: HistoryEntry) {
  await withStore<void>('readwrite', (store) => {
    store.put(entry);
  });

  const entries = await listHistoryEntries();

  if (entries.length > MAX_HISTORY_ITEMS) {
    await Promise.all(entries.slice(MAX_HISTORY_ITEMS).map((item) => deleteHistoryEntry(item.id)));
  }
}

export async function deleteHistoryEntry(entryId: string) {
  await withStore<void>('readwrite', (store) => {
    store.delete(entryId);
  });
}

export async function clearHistoryEntries() {
  await withStore<void>('readwrite', (store) => {
    store.clear();
  });
}
