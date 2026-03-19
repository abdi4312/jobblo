const cloudinary = require("../config/cloudinary");
const { v4: uuidv4 } = require("uuid");

/**
 * Upload a file buffer to Cloudinary
 * @param {Object} file - The file object from multer (req.file)
 * @param {string} folder - The folder name in Cloudinary
 * @returns {Promise<string>} - The URL of the uploaded image
 */
const uploadToCloudinary = (file, folder = "hero") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        public_id: `${uuidv4()}`,
        resource_type: "auto",
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result.secure_url);
      }
    );

    uploadStream.end(file.buffer);
  });
};

/**
 * Delete an image from Cloudinary by its URL
 * @param {string} url - The secure URL of the image
 */
const deleteFromCloudinary = async (url) => {
  try {
    if (!url) return;
    // Extract public_id from URL
    // Example: https://res.cloudinary.com/demo/image/upload/v12345678/folder/public_id.jpg
    const parts = url.split("/");
    const filenameWithExt = parts.pop();
    const folder = parts.pop();
    const publicId = `${folder}/${filenameWithExt.split(".")[0]}`;
    
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary delete error:", error);
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
};
