const DB_NAME = 'jobblo-form-db';
const STORE_NAME = 'job-form-data';
const DB_VERSION = 1;

interface StoredFormData {
  id: string;
  data: any;
  images?: Array<{ name: string; type: string; base64: string }>;
  createdAt: number;
}

// Initialize IndexedDB
const openDB = (): Promise<IDBDatabase> => {
  console.log('[IndexedDB] Opening database...');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[IndexedDB] Error opening database:', request.error);
      reject(request.error);
    };
    request.onsuccess = () => {
      console.log('[IndexedDB] Database opened successfully!');
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      console.log('[IndexedDB] Upgrading database...');
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        console.log('[IndexedDB] Creating object store...');
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// Helper to convert File to base64 for storage
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper to convert base64 back to File
const base64ToFile = (base64: string, filename: string): File => {
  const arr = base64.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

// Save form data and images
export const saveFormData = async (data: any, images: File[] = []): Promise<void> => {
  console.log('[IndexedDB] Saving form data...', data);
  const db = await openDB();

  // Convert images to base64
  const base64Images = await Promise.all(
    images.map(async (img) => ({
      name: img.name,
      type: img.type,
      base64: await fileToBase64(img),
    }))
  );

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({
      id: 'current-form',
      data,
      images: base64Images,
      createdAt: Date.now(),
    });

    request.onsuccess = () => {
      console.log('[IndexedDB] Form data saved successfully!');
      resolve();
    };
    request.onerror = () => {
      console.error('[IndexedDB] Error saving form data:', request.error);
      reject(request.error);
    };
  });
};

// Load form data and images
export const loadFormData = async (): Promise<{
  data?: any;
  images?: File[];
}> => {
  console.log('[IndexedDB] Loading form data...');
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('current-form');

    request.onsuccess = () => {
      const stored = request.result as StoredFormData | undefined;
      console.log('[IndexedDB] Got stored data:', stored);
      if (!stored) {
        console.log('[IndexedDB] No stored data found');
        resolve({});
        return;
      }

      // Check if data is older than 24 hours
      const isExpired = Date.now() - stored.createdAt > 24 * 60 * 60 * 1000;
      if (isExpired) {
        console.log('[IndexedDB] Stored data expired, clearing...');
        // Clear expired data
        clearFormData()
          .then(() => resolve({}))
          .catch(() => resolve({}));
        return;
      }

      // Convert base64 back to File objects
      let images: File[] = [];
      if (stored.images) {
        images = stored.images.map((imgData) => base64ToFile(imgData.base64, imgData.name));
      }

      console.log('[IndexedDB] Loaded form data and images!');
      resolve({ data: stored.data, images });
    };

    request.onerror = () => {
      console.error('[IndexedDB] Error loading form data:', request.error);
      reject(request.error);
    };
  });
};

// Clear form data
export const clearFormData = async (): Promise<void> => {
  console.log('[IndexedDB] Clearing form data...');
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete('current-form');

    request.onsuccess = () => {
      console.log('[IndexedDB] Form data cleared successfully!');
      resolve();
    };
    request.onerror = () => {
      console.error('[IndexedDB] Error clearing form data:', request.error);
      reject(request.error);
    };
  });
};
