import express from 'express';
import TouristEntityController from '../../controllers/user/PlacesController.js';

const router = express.Router();

router.get('/places/nearby-by-coordinates', TouristEntityController.getNearbyPlacesByCoordinates); // สถานที่ใกล้เคียงตามพิกัดปัจจุบันของผู้ใช้

export default router;