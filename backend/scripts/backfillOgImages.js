// One-off backfill: generate 1200×630 JPEG "OG" versions for listings uploaded
// before OG derivatives existed, so their social share cards render the big
// landscape image (WhatsApp/Facebook) instead of a small thumbnail or empty box.
//
// It fetches each listing's first Azure photo, resizes it with the SAME makeOgBuffer
// the upload middleware uses (no duplicated logic), uploads the result to
// job_images/og/, and writes ogUrl/ogBlobName into imageMetadata.
//
// Safe to re-run: a listing that already has an ogUrl on its first image is skipped.
// Cloudinary listings are skipped too — those are resized on the fly by the preview
// (cardImageUrl), so they need no stored derivative.
//
// Run:  node scripts/backfillOgImages.js          (real run)
//       node scripts/backfillOgImages.js --dry     (report only, no writes)

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');
const Service = require('../models/Service');
const { makeOgBuffer } = require('../middleware/upload');
const { uploadBufferToAzure } = require('../utils/azureUpload');

const DRY = process.argv.includes('--dry');

/** Fetch an image URL into a Buffer, or null on any failure (a bad URL is skipped). */
async function fetchBuffer(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** The first usable photo URL for a listing, or null. */
function firstPhoto(service) {
  if (!Array.isArray(service.images)) return null;
  return service.images.find((i) => typeof i === 'string' && i.trim()) || null;
}

/** Does the first image already have an OG derivative? */
function firstAlreadyHasOg(service) {
  const first = firstPhoto(service);
  if (!first || !Array.isArray(service.imageMetadata)) return false;
  const meta = service.imageMetadata.find((m) => m && m.url === first);
  return !!(meta && meta.ogUrl);
}

async function run() {
  await connectDB();

  // Only listings that have at least one image and no OG on it yet. Cloudinary is
  // handled at render time, so restrict to Azure-hosted photos.
  const services = await Service.find({
    images: { $exists: true, $ne: [] },
  }).select('images imageMetadata');

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const service of services) {
    const first = firstPhoto(service);
    if (!first || !first.includes('blob.core.windows.net') || firstAlreadyHasOg(service)) {
      skipped += 1;
      continue;
    }

    const buffer = await fetchBuffer(first);
    if (!buffer) {
      console.warn('skip (fetch failed): %s', service._id);
      failed += 1;
      continue;
    }

    if (DRY) {
      console.log('would backfill: %s  <- %s', service._id, first);
      processed += 1;
      continue;
    }

    try {
      const ogBuffer = await makeOgBuffer(buffer);
      const { url: ogUrl, blobName: ogBlobName } = await uploadBufferToAzure(
        { buffer: ogBuffer, originalname: 'og.jpg', mimetype: 'image/jpeg' },
        'job_images/og'
      );

      // Attach the OG derivative to the first image's metadata, creating the entry if
      // the listing predates imageMetadata entirely.
      const meta = Array.isArray(service.imageMetadata) ? service.imageMetadata : [];
      const entry = meta.find((m) => m && m.url === first);
      if (entry) {
        entry.ogUrl = ogUrl;
        entry.ogBlobName = ogBlobName;
      } else {
        meta.unshift({ url: first, ogUrl, ogBlobName });
      }
      service.imageMetadata = meta;
      await service.save();

      console.log('backfilled: %s', service._id);
      processed += 1;
    } catch (err) {
      console.error('failed: %s — %s', service._id, err.message);
      failed += 1;
    }
  }

  console.log(
    '\nDone. processed=%d skipped=%d failed=%d (dry=%s)',
    processed,
    skipped,
    failed,
    DRY
  );
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
