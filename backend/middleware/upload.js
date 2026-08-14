const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isPdf =
      file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    return {
      folder: req.baseUrl.includes('users') ? 'profile_images' : 'job_images',
      // allowed_formats should only be used for resource_type: 'image'
      ...(isPdf ? {} : { allowed_formats: ['jpg', 'png', 'jpeg', 'webp'] }),
      resource_type: isPdf ? 'raw' : 'image',
    };
  },
});

// The 2 MB cap used to exist only in the browser (ImageUpload.tsx), so anything
// that wasn't the web form could push files of any size or type straight into
// Cloudinary — multer-storage-cloudinary uploads before the controller ever runs,
// so a rejected request still costs storage. These limits are the server's own.
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
  'application/pdf',
]);

const upload = multer({
  storage: storage,
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

module.exports = upload;
module.exports.MAX_FILE_BYTES = MAX_FILE_BYTES;
