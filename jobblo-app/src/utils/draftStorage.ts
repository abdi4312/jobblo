type DraftStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const nativeAsyncStorage = (() => {
  try {
    const storage = require('@react-native-async-storage/async-storage');
    return storage?.default ?? storage ?? null;
  } catch {
    return null;
  }
})();

const browserStorage: DraftStorage = {
  getItem: async (key) => (typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(key) : null),
  setItem: async (key, value) => { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(key, value); },
  removeItem: async (key) => { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(key); },
};

export const draftStorage: DraftStorage = {
  async getItem(key) {
    try {
      return nativeAsyncStorage ? await nativeAsyncStorage.getItem(key) : await browserStorage.getItem(key);
    } catch {
      return browserStorage.getItem(key);
    }
  },
  async setItem(key, value) {
    try {
      if (nativeAsyncStorage) { await nativeAsyncStorage.setItem(key, value); return; }
    } catch { /* use browser storage when native storage is unavailable */ }
    await browserStorage.setItem(key, value);
  },
  async removeItem(key) {
    try {
      if (nativeAsyncStorage) { await nativeAsyncStorage.removeItem(key); return; }
    } catch { /* use browser storage when native storage is unavailable */ }
    await browserStorage.removeItem(key);
  },
};
