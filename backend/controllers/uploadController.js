// controllers/uploadController.js
const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');

const containerName = process.env.AZURE_CONTAINER_NAME || 'bilder-newsub';

if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    console.warn('⚠ AZURE_STORAGE_CONNECTION_STRING mangler i .env');
}

const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
);

// felles helper for å laste opp én filbuffer til Azure
async function uploadBufferToAzure(file, folder = 'misc') {
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // filnavn: folder/userid/uuid.ext
    const ext = file.originalname.split('.').pop();
    const blobName = `${folder}/${uuidv4()}.${ext}`;

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: { blobContentType: file.mimetype }
    });

    return blockBlobClient.url;
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

        const url = await uploadBufferToAzure(req.file, `profile/${req.userId}`);

        // her kan du evt. oppdatere User-modellen med url om du vil

        res.status(201).json({
            message: 'Profilbilde lastet opp',
            url
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
            const url = await uploadBufferToAzure(file, `service/${req.userId}`);
            urls.push(url);
        }

        // frontend sender disse urlene videre til Service/Job-API-et og lagrer der
        res.status(201).json({
            message: 'Bilder lastet opp',
            urls
        });
    } catch (err) {
        console.error('Upload service error:', err);
        res.status(500).json({ error: 'Kunne ikke laste opp bilder' });
    }
};
