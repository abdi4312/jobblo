// controllers/uploadController.js
const { uploadBufferToAzure } = require('../utils/azureUpload');

// Standalone upload endpoints return just the URL to the frontend.
async function uploadUrl(file, folder) {
  const { url } = await uploadBufferToAzure(file, folder);
  return url;
}

/**
 * Last opp profilbilde (single file)
 * expects field name: "image"
 */
exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Ingen fil mottatt (bruk field "image")' });
    }

    // enkel filtype-sjekk
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Kun bildefiler er tillatt' });
    }

    const url = await uploadUrl(req.file, `profile_images/${req.userId}`);

    // her kan du evt. oppdatere User-modellen med url om du vil

    res.status(201).json({
      message: 'Profilbilde lastet opp',
      url,
    });
  } catch (err) {
    console.error('Upload profile error:', err);
    res.status(500).json({ error: 'Kunne ikke laste opp bilde' });
  }
};

/**
 * Last opp ett eller flere bilder til en service/job
 * expects field name: "images"
 */
exports.uploadServiceImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Ingen filer mottatt (bruk field "images")' });
    }

    const urls = [];
    for (const file of req.files) {
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: 'Kun bildefiler er tillatt' });
      }
      const url = await uploadUrl(file, `job_images/${req.userId}`);
      urls.push(url);
    }

    // frontend sender disse urlene videre til Service/Job-API-et og lagrer der
    res.status(201).json({
      message: 'Bilder lastet opp',
      urls,
    });
  } catch (err) {
    console.error('Upload service error:', err);
    res.status(500).json({ error: 'Kunne ikke laste opp bilder' });
  }
};
