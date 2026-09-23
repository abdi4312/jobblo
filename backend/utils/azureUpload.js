// utils/azureUpload.js
//
// Single source of truth for image/file storage on Azure Blob Storage.
// Every upload lands in one container (AZURE_CONTAINER_NAME), separated by a
// folder prefix per upload type:
//   job_images/…, profile_images/…, hero/…,
//   orders/<orderId>/evidence/…, reviews/<orderId>/…, report-evidence/…
//
// Blobs are named "<folder>/<uuid>.<ext>". The blob name (the path inside the
// container) is what deletion needs — callers persist it and pass it back to
// deleteFromAzure. deleteFromAzure also accepts a full blob URL for the legacy
// fields that only stored the URL (e.g. Hero.image).
const { BlobServiceClient } = require('@azure/storage-blob');
// Node's built-in UUID v4 — no dependency, and (unlike the ESM-only `uuid`
// package) it loads cleanly under Jest's CommonJS runtime.
const { randomUUID } = require('crypto');

const containerName = process.env.AZURE_CONTAINER_NAME || 'bilder-newsub';

if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
  console.warn('⚠ AZURE_STORAGE_CONNECTION_STRING mangler i .env');
}

// Lazy singletons. Building the client at require-time would crash the whole
// app on boot if the connection string is missing; deferring it means only the
// upload path fails, and with a clear message.
let _blobServiceClient = null;
function getContainerClient() {
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is not configured');
  }
  if (!_blobServiceClient) {
    _blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );
  }
  return _blobServiceClient.getContainerClient(containerName);
}

function safeExt(originalname = '') {
  const parts = String(originalname).split('.');
  // No dot, or a trailing dot, means no usable extension.
  if (parts.length < 2) return 'bin';
  const ext = parts.pop().toLowerCase();
  // Guard against a filename like "evil/../x.jpg" smuggling a path segment.
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : 'bin';
}

/**
 * Upload one multer file buffer to Azure.
 * @param {{buffer:Buffer, originalname?:string, mimetype?:string}} file
 * @param {string} folder - prefix inside the container (e.g. 'job_images')
 * @returns {Promise<{url:string, blobName:string}>}
 */
async function uploadBufferToAzure(file, folder = 'misc') {
  const containerClient = getContainerClient();
  const ext = safeExt(file.originalname);
  const blobName = `${folder}/${randomUUID()}.${ext}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype || 'application/octet-stream' },
  });

  return { url: blockBlobClient.url, blobName };
}

/**
 * Upload one multer file buffer to Azure and return just the URL.
 * Thin wrapper for callers that don't track the blob name separately (they
 * delete via the stored URL instead).
 * @param {Object} file - multer file (needs .buffer)
 * @param {string} folder - prefix inside the container
 * @returns {Promise<string>} the blob URL
 */
async function uploadToAzure(file, folder = 'misc') {
  const { url } = await uploadBufferToAzure(file, folder);
  return url;
}

/**
 * Turn a stored blob URL back into its blob name (the container-relative path).
 * Needed for the legacy call sites that only persisted the URL (Hero.image).
 * Example:
 *   https://acct.blob.core.windows.net/bilder-newsub/hero/uuid.jpg -> hero/uuid.jpg
 * Returns null when the URL clearly isn't one of our blobs.
 */
function blobNameFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  let pathname;
  try {
    pathname = new URL(url).pathname; // "/<container>/<folder>/<file>"
  } catch {
    return null;
  }
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  // First segment is the container name; the rest is the blob name.
  if (segments.length < 2 || segments[0] !== containerName) return null;
  return segments.slice(1).join('/');
}

/**
 * Delete a blob. Best-effort: a missing blob is not an error.
 * Accepts either a blob name (folder/uuid.ext) or a full blob URL — a value
 * that looks like a URL is converted back to its blob name first.
 * @param {string} blobNameOrUrl
 */
async function deleteFromAzure(blobNameOrUrl) {
  if (!blobNameOrUrl) return;
  const blobName = /^https?:\/\//i.test(blobNameOrUrl)
    ? blobNameFromUrl(blobNameOrUrl)
    : blobNameOrUrl;
  if (!blobName) return;
  try {
    const containerClient = getContainerClient();
    await containerClient.getBlockBlobClient(blobName).deleteIfExists();
  } catch (error) {
    console.error('Azure delete error for %s: %s', blobName, error.message);
  }
}

module.exports = {
  uploadBufferToAzure,
  uploadToAzure,
  deleteFromAzure,
  blobNameFromUrl,
  containerName,
};
