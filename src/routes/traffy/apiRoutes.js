import express from 'express';
import axios from 'axios';

const router = express.Router();

const TRAFFY_API_BASE_URL = "https://publicapi.traffy.in.th/teamchadchart-stat-api/geojson/v1";

// ดึงข้อมูลสถานะ 'start'
router.get('/traffy/start', async (req, res) => {
  try {
    const response = await axios.get(`${TRAFFY_API_BASE_URL}?state_type=start`, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching 'start' data:", error.message);
    res.status(500).json({ error: "Failed to fetch 'start' data" });
  }
});

// ดึงข้อมูลสถานะ 'inprogress'
router.get('/traffy/inprogress', async (req, res) => {
  try {
    const response = await axios.get(`${TRAFFY_API_BASE_URL}?state_type=inprogress`, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching 'inprogress' data:", error.message);
    res.status(500).json({ error: "Failed to fetch 'inprogress' data" });
  }
});

router.get('/traffy/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 5000, state } = req.query;
    console.log("Received parameters:", { lat, lng, radius, state });

    if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng))) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    if (!state || (state !== "start" && state !== "inprogress")) {
      return res.status(400).json({ error: "Invalid state value" });
    }

    const radiusValue = parseInt(radius, 10) || 5000;

    const apiUrl = `https://publicapi.traffy.in.th/premium-org-fondue/geojson/v1?org_key=bangkok&state_type=${state}`;
    console.log("Calling external API:", apiUrl);

    const response = await axios.get(apiUrl, {
      headers: {
        accept: "application/json, text/plain, */*",
      },
    });

    console.log("External API response received:", response.data);

    const places = response.data.features.filter((place) => {
      const distance = calculateDistance(lat, lng, place.geometry.coordinates[1], place.geometry.coordinates[0]);
      return distance <= radiusValue;
    });

    console.log("Filtered places by radius:", places);
    res.json({ features: places });
  } catch (error) {
    console.error("Error in /traffy/nearby:", error.message);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
});

// Helper function to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}



export default router;
