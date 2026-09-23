/**
 * Image storage lives on Azure Blob Storage.
 *
 * These tests lock that in: an upload must produce an Azure Blob URL, the blob
 * name must carry the per-type folder prefix that keeps job images apart from
 * profile images, and deletion must work whether the caller kept the blob name
 * or only the stored URL (the legacy Hero.image case).
 *
 * The Azure SDK is mocked, so this runs offline and fast. A separate live check
 * against a real account was run manually; this is the always-on regression guard.
 */

// The module reads AZURE_CONTAINER_NAME at require-time, so pin it BEFORE require.
process.env.AZURE_CONTAINER_NAME = 'test-images';
process.env.AZURE_STORAGE_CONNECTION_STRING =
  'DefaultEndpointsProtocol=https;AccountName=acct;AccountKey=' +
  Buffer.from('key').toString('base64') +
  '==;EndpointSuffix=core.windows.net';

// In-memory stand-in for the container: blobName -> { data, contentType }.
const store = new Map();

// Mock the Azure SDK. getBlockBlobClient(name).url mirrors the real URL shape so
// blobNameFromUrl can round-trip it.
jest.mock('@azure/storage-blob', () => {
  const ACCOUNT = 'acct';
  const container = 'test-images';
  return {
    BlobServiceClient: {
      fromConnectionString: () => ({
        getContainerClient: () => ({
          getBlockBlobClient: (blobName) => ({
            url: `https://${ACCOUNT}.blob.core.windows.net/${container}/${blobName
              .split('/')
              .map(encodeURIComponent)
              .join('/')}`,
            uploadData: async (data, opts) => {
              store.set(blobName, {
                data,
                contentType: opts?.blobHTTPHeaders?.blobContentType,
              });
            },
            deleteIfExists: async () => {
              const existed = store.has(blobName);
              store.delete(blobName);
              return { succeeded: existed };
            },
            exists: async () => store.has(blobName),
          }),
        }),
      }),
    },
  };
});

const {
  uploadBufferToAzure,
  uploadToAzure,
  deleteFromAzure,
  blobNameFromUrl,
  containerName,
} = require('../utils/azureUpload');

const file = (name = 'photo.png', mimetype = 'image/png') => ({
  buffer: Buffer.from('bytes'),
  originalname: name,
  mimetype,
});

beforeEach(() => store.clear());

describe('uploadBufferToAzure', () => {
  it('returns an Azure Blob URL', async () => {
    const { url } = await uploadBufferToAzure(file(), 'job_images');
    // Positive check: the URL must be an Azure Blob endpoint. Anything from a
    // different storage provider fails this and never reaches the DB.
    expect(url.startsWith('https://acct.blob.core.windows.net/')).toBe(true);
  });

  it('names the blob "<folder>/<uuid>.<ext>" and actually stores it', async () => {
    const { url, blobName } = await uploadBufferToAzure(file('a.png'), 'job_images');
    expect(blobName).toMatch(
      /^job_images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/
    );
    expect(store.has(blobName)).toBe(true);
    // The URL and the blob name describe the same object.
    expect(blobNameFromUrl(url)).toBe(blobName);
  });

  it('keeps job and profile uploads in separate folders', async () => {
    const job = await uploadBufferToAzure(file(), 'job_images');
    const profile = await uploadBufferToAzure(file(), 'profile_images/user123');
    expect(job.blobName.startsWith('job_images/')).toBe(true);
    expect(profile.blobName.startsWith('profile_images/user123/')).toBe(true);
  });

  it('preserves the content type on the stored blob', async () => {
    const { blobName } = await uploadBufferToAzure(file('x.webp', 'image/webp'), 'hero');
    expect(store.get(blobName).contentType).toBe('image/webp');
  });

  it('falls back to a safe extension when the filename has none or is hostile', async () => {
    const noExt = await uploadBufferToAzure(file('noext'), 'hero');
    expect(noExt.blobName.endsWith('.bin')).toBe(true);
    // A filename trying to smuggle a path/odd extension must not leak into the key.
    const weird = await uploadBufferToAzure(file('a.b/../c'), 'hero');
    expect(weird.blobName).toMatch(/^hero\/[0-9a-f-]{36}\.bin$/);
  });
});

describe('uploadToAzure (URL-only helper)', () => {
  it('returns just the Azure URL string', async () => {
    const url = await uploadToAzure(file(), 'report-evidence');
    expect(typeof url).toBe('string');
    expect(url).toContain('.blob.core.windows.net');
    expect(blobNameFromUrl(url).startsWith('report-evidence/')).toBe(true);
  });
});

describe('blobNameFromUrl', () => {
  const base = `https://acct.blob.core.windows.net/${containerName}`;

  it('maps a stored URL back to its blob name', () => {
    expect(blobNameFromUrl(`${base}/hero/uuid.jpg`)).toBe('hero/uuid.jpg');
    expect(blobNameFromUrl(`${base}/orders/64abc/evidence/x.png`)).toBe(
      'orders/64abc/evidence/x.png'
    );
  });

  it('decodes URL-encoded segments', () => {
    expect(blobNameFromUrl(`${base}/job%20images/a.jpg`)).toBe('job images/a.jpg');
  });

  it('returns null for foreign or malformed URLs', () => {
    expect(blobNameFromUrl('https://cdn.example.com/demo/image/v1/x.jpg')).toBeNull();
    expect(blobNameFromUrl('https://acct.blob.core.windows.net/other-container/a.jpg')).toBeNull();
    expect(blobNameFromUrl('not a url')).toBeNull();
    expect(blobNameFromUrl('')).toBeNull();
    expect(blobNameFromUrl(null)).toBeNull();
    expect(blobNameFromUrl(undefined)).toBeNull();
  });
});

describe('deleteFromAzure', () => {
  it('deletes by blob name', async () => {
    const { blobName } = await uploadBufferToAzure(file(), 'job_images');
    expect(store.has(blobName)).toBe(true);
    await deleteFromAzure(blobName);
    expect(store.has(blobName)).toBe(false);
  });

  it('deletes by full URL (the legacy Hero.image path)', async () => {
    const { url, blobName } = await uploadBufferToAzure(file(), 'hero');
    await deleteFromAzure(url);
    expect(store.has(blobName)).toBe(false);
  });

  it('is a safe no-op for empty input or a non-Azure URL', async () => {
    const { blobName } = await uploadBufferToAzure(file(), 'hero');
    await expect(deleteFromAzure(undefined)).resolves.toBeUndefined();
    await expect(deleteFromAzure('')).resolves.toBeUndefined();
    // A URL from some other host must not throw and must not touch our store.
    await deleteFromAzure('https://cdn.example.com/demo/image/v1/x.jpg');
    expect(store.has(blobName)).toBe(true);
  });
});
