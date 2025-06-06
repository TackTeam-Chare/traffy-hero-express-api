import express from 'express';
import TouristEntityController from '../../controllers/user/PlacesController.js';
const router = express.Router();
import upload from '../../config/multer.js';
router.get('/places/nearby-by-coordinates', TouristEntityController.getNearbyPlacesByCoordinates); // สถานที่ใกล้เคียงตามพิกัดปัจจุบันของผู้ใช้
// router.post("/save-review", upload.single("image"), TouristEntityController.saveReview);
router.post(
    "/save-review",
    upload.array("images", 10), // Accept up to 10 images
    TouristEntityController.saveReview
);
router.get('/user/review-history', TouristEntityController.getUserReviewHistory);
router.get('/places/search', TouristEntityController.searchPlaces);
// ดึงข้อมูลหมวดหมู่ทั้งหมด
router.get('/categories', TouristEntityController.getAllCategories);
router.get('/dashboard/:userId', TouristEntityController.getUserDashboard);
export default router;