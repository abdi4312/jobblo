/**
 * The one place the persisted session lives.
 *
 * `src/store/authStore.ts` and `src/api/client.ts` each used to carry their own copy of
 * this shim, and both copies had the same defect: a hard AsyncStorage failure was caught
 * and silently replaced with a no-op stub. On a device that means nothing is ever written
 * and every read returns `null` — which does not present as an error, it presents as
 * "logged out again after every reload". The failure was invisible exactly where it
 * mattered, so this module probes a backend before trusting it and says so loudly when
 * none of them work.
 */

type StorageBackend = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const PROBE_KEY = '__jobblo_storage_probe__';

/**
 * A present module is not a working module. async-storage v3 resolves to an object whose
 * `getItem` IS a function but throws `Native module is null` on first call when the running
 * app does not ship the matching native module — so shape checks pass and every read still
 * fails. Only `worksAtRuntime` below can tell the difference.
 */
function resolveNativeStorage(): StorageBackend | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-async-storage/async-storage');
    const candidate = mod?.default ?? mod ?? null;
    return typeof candidate?.getItem === 'function' ? (candidate as StorageBackend) : null;
  } catch {
    return null;
  }
}

function resolveWebStorage(): StorageBackend | null {
  // `window` exists in React Native; `window.localStorage` does not. Both checks are needed.
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const local = window.localStorage;
  return {
    getItem: async (key) => local.getItem(key),
    setItem: async (key, value) => {
      local.setItem(key, value);
    },
    removeItem: async (key) => {
      local.removeItem(key);
    },
  };
}

/**
 * Last resort. Keeps the session coherent for the rest of the JS context so the app does not
 * behave erratically mid-session, but it does NOT survive a reload — hence the loud log in
 * `selectBackend`.
 */
const memoryStore = new Map<string, string>();
const memoryStorage: StorageBackend = {
  getItem: async (key) => memoryStore.get(key) ?? null,
  setItem: async (key, value) => {
    memoryStore.set(key, value);
  },
  removeItem: async (key) => {
    memoryStore.delete(key);
  },
};

/** Real write → read → delete round trip. The only honest test of a storage backend. */
async function worksAtRuntime(candidate: StorageBackend): Promise<boolean> {
  try {
    await candidate.setItem(PROBE_KEY, '1');
    const echoed = await candidate.getItem(PROBE_KEY);
    await candidate.removeItem(PROBE_KEY);
    return echoed === '1';
  } catch {
    return false;
  }
}

async function selectBackend(): Promise<StorageBackend> {
  const native = resolveNativeStorage();
  if (native && (await worksAtRuntime(native))) return native;

  const web = resolveWebStorage();
  if (web && (await worksAtRuntime(web))) return web;

  console.error(
    '[jobblo] No working persistent storage backend — the session will NOT survive a reload. ' +
      'On a device this almost always means the @react-native-async-storage/async-storage ' +
      'native module in the running app does not match the installed JS package. ' +
      'Run `npx expo install --check`.'
  );
  return memoryStorage;
}

/** Selected once per JS context; every caller awaits the same selection. */
let selection: Promise<StorageBackend> | null = null;

function backend(): Promise<StorageBackend> {
  if (!selection) selection = selectBackend();
  return selection;
}

/**
 * A backend that passed the probe can still fail later (storage full, database evicted).
 * Degrading to memory keeps the current session usable instead of throwing into
 * `hydrate()`'s catch block, which would sign the user out.
 */
async function withFallback<T>(op: (target: StorageBackend) => Promise<T>): Promise<T> {
  const target = await backend();
  try {
    return await op(target);
  } catch (error) {
    console.error('[jobblo] Storage operation failed; degrading to in-memory session.', error);
    return op(memoryStorage);
  }
}

export const authStorage = {
  getItem: (key: string) => withFallback((target) => target.getItem(key)),
  setItem: (key: string, value: string) => withFallback((target) => target.setItem(key, value)),
  removeItem: (key: string) => withFallback((target) => target.removeItem(key)),
};

/** `false` means logins cannot survive a reload on this build. Useful for a dev-only banner. */
export async function isSessionPersistent(): Promise<boolean> {
  return (await backend()) !== memoryStorage;
}
