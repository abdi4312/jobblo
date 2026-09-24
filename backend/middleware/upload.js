const multer = require('multer');
const sharp = require('sharp');
const { uploadBufferToAzure } = require('../utils/azureUpload');

// Social share cards (WhatsApp/Facebook) only render the big landscape card when the
// fetched image really is a wide ~1200×630. User uploads are any shape, and Azure Blob
// cannot resize from a URL the way Cloudinary can — so we derive a fixed 1200×630 JPEG
// once, at upload time, and store it alongside the original. `fit: 'cover'` crops to the
// frame; a white flatten covers PNG/WEBP transparency so the card is never see-through.
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

async function makeOgBuffer(buffer) {
  return sharp(buffer)
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'attention' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 82 })
    .toBuffer();
}

// Buffers uploads in memory and pushes them to Azure Blob in a post-multer step,
// exposing the SAME file.path (URL) + file.filename (blobName) shape the
// controllers (userController, serviceController) already read.

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
  'application/pdf',
]);

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: 6, // matches the "inntil 6 bilder" the job form promises
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    const err = new Error('Ugyldig filtype. Last opp JPG, PNG, WEBP eller PDF.');
    err.code = 'INVALID_FILE_TYPE';
    cb(err);
  },
});

// User routes mount under /users -> profile images; everything else is a job.
function folderFor(req) {
  return req.baseUrl.includes('users') ? 'profile_images' : 'job_images';
}

// Upload each buffered file to Azure, then attach: file.path = URL,
// file.filename = blobName (what deletion needs).
async function pushToAzure(req) {
  const folder = folderFor(req);
  const all = [];
  if (req.file) all.push(req.file);
  if (Array.isArray(req.files)) all.push(...req.files);
  else if (req.files) for (const key of Object.keys(req.files)) all.push(...req.files[key]);

  for (const file of all) {
    const { url, blobName } = await uploadBufferToAzure(file, folder);
    file.path = url;
    file.filename = blobName;

    // Only images get an OG derivative; a PDF (report evidence) has no card use.
    if (folder === 'job_images' && /^image\//.test(file.mimetype || '')) {
      try {
        const ogBuffer = await makeOgBuffer(file.buffer);
        const { url: ogUrl, blobName: ogBlobName } = await uploadBufferToAzure(
          { buffer: ogBuffer, originalname: 'og.jpg', mimetype: 'image/jpeg' },
          `${folder}/og`
        );
        file.ogPath = ogUrl;
        file.ogFilename = ogBlobName;
      } catch (err) {
        // A bad OG render must never block the real upload — the card just falls back
        // to the original image (small-thumbnail) instead of failing the whole post.
        console.error('OG image generation failed: %s', err.message);
      }
    }
  }
}

// Wrap a multer middleware so the Azure upload runs right after it, before the
// controller. Errors from either step flow to the same next().
function wrap(multerMw) {
  return (req, res, next) => {
    multerMw(req, res, (err) => {
      if (err) return next(err);
      pushToAzure(req)
        .then(() => next())
        .catch(next);
    });
  };
}

// Same call surface as before: upload.single(...), .array(...), .fields(...).
const upload = {
  single: (field) => wrap(multerUpload.single(field)),
  array: (field, max) => wrap(multerUpload.array(field, max)),
  fields: (fields) => wrap(multerUpload.fields(fields)),
  none: () => multerUpload.none(),
};

module.exports = upload;
module.exports.MAX_FILE_BYTES = MAX_FILE_BYTES;
// Reused by scripts/backfillOgImages.js so old listings get the same 1200×630 JPEG.
module.exports.makeOgBuffer = makeOgBuffer;
