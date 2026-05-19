const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isPdf =
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf");
    return {
      folder: req.baseUrl.includes("users") ? "profile_images" : "job_images",
      // allowed_formats should only be used for resource_type: 'image'
      ...(isPdf ? {} : { allowed_formats: ["jpg", "png", "jpeg", "webp"] }),
      resource_type: isPdf ? "raw" : "image",
    };
  },
});

const upload = multer({ storage: storage });

module.exports = upload;
