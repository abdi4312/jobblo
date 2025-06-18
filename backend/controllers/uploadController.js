exports.uploadImage = (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.status(200).json({ imageUrl: `/uploads/${req.file.filename}` });
};
