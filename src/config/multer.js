import multer from 'multer'; // For file uploads
import path from 'path'; // For handling paths
import { fileURLToPath } from 'url'; // To resolve file paths in ES modules
import sharp from 'sharp'; // For image processing
import fs from 'fs/promises'; // For file system operations

// Derive __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer storage configuration
const storage = multer.memoryStorage(); // Store files in memory for processing with Sharp

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG and PNG files are allowed!'));
  }
};

// Multer instance
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // Limit file size to 20MB
  fileFilter,
});

// Function to process and save images
export const processAndSaveImage = async (buffer, originalName) => {
  try {
    const outputDir = path.resolve(__dirname, '../../uploads'); // Ensure absolute path
    await fs.mkdir(outputDir, { recursive: true }); // Create uploads directory if it doesn't exist

    const outputPath = path.join(outputDir, `${Date.now()}-${originalName}`);
    console.log('Saving file to:', outputPath);

    // Process and save image with Sharp
    await sharp(buffer)
      .rotate() // Correct orientation based on EXIF data
      .resize({ width: 800 }) // Resize image width to a maximum of 800px
      .jpeg({ quality: 80 }) // Convert image to JPEG with 80% quality
      .toFile(outputPath);

    return `/uploads/${path.basename(outputPath)}`; // Return relative path for the saved file
  } catch (error) {
    console.error('Error processing and saving image:', error.message);
    throw new Error('Failed to process and save image');
  }
};

export default upload;