const { BlobServiceClient } = require("@azure/storage-blob");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv"); 
dotenv.config();
const containerName = process.env.AZURE_CONTAINER_NAME || "bilder-newsub";

if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
  console.warn("⚠ AZURE_STORAGE_CONNECTION_STRING mangler i .env");
}

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

/**
 * Upload file buffer to Azure
 */
async function uploadBufferToAzure(file, folder = "misc") {
  const containerClient = blobServiceClient.getContainerClient(containerName);

  const ext = file.originalname.split(".").pop();
  const blobName = `${folder}/${uuidv4()}.${ext}`;

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype },
  });

  return blockBlobClient.url;
}

/**
 * Delete image from Azure using full URL
 */
async function deleteFromAzureByUrl(fileUrl) {
  if (!fileUrl) return;

  const containerClient = blobServiceClient.getContainerClient(containerName);

  // extract blob path from URL
  const blobPath = decodeURIComponent(
    fileUrl.split(`/${containerName}/`)[1]
  );

  if (!blobPath) return;

  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
  await blockBlobClient.deleteIfExists();
}

module.exports = {
  uploadBufferToAzure,
  deleteFromAzureByUrl,
};
