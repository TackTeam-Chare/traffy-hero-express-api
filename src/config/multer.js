import multer from 'multer'; // นำเข้าโมดูล `multer` เพื่อใช้จัดการการอัปโหลดไฟล์
import path from 'path'; // นำเข้าโมดูล `path` เพื่อใช้จัดการเส้นทางไฟล์ (Path handling)
import {
  fileURLToPath
} from 'url'; // นำเข้า `fileURLToPath` จาก `url` เพื่อแปลง URL เป็นเส้นทางไฟล์ (file path)

// แปลง URL ของไฟล์ปัจจุบันเป็น path ของไฟล์
const __filename = fileURLToPath(import.meta.url);

// ดึง directory ของไฟล์ปัจจุบันจาก path ที่แปลงแล้ว
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.resolve(__dirname, '../../uploads'); // โฟลเดอร์สำหรับเก็บไฟล์
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

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
const upload = multer({
  storage: storage, // ใช้ตัวแปร storage ที่ตั้งค่าไว้
  limits: { fileSize: 20 * 1024 * 1024 }, // กำหนดขนาดไฟล์สูงสุด 20MB
  fileFilter: fileFilter // ใช้ฟังก์ชันกรองไฟล์
});

export default multer({
  upload,
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter,

});



