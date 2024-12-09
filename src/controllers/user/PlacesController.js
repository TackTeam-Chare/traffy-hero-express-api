import pool from '../../config/db.js';

const getNearbyPlacesByCoordinates = async (req, res) => {
    try {
      const { lat, lng, radius = 500 } = req.query;
  
      // Validate coordinates
      if (
        !lat ||
        !lng ||
        isNaN(Number(lat)) ||
        isNaN(Number(lng)) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }
  
      // Ensure radius is a valid number
      let radiusValue = parseInt(radius, 10);
      if (isNaN(radiusValue) || radiusValue <= 0) {
        radiusValue = 500; // Default radius to 5000 meters
      }
  
      console.log(
        `Fetching data from traffy_data with coordinates lat: ${lat}, lng: ${lng}, radius: ${radiusValue} meters`
      );
  
      // Query to fetch places
      const query = `
        SELECT 
          id,
          ticket_id,
          type,
          organization,
          organization_action,
          comment,
          coords,
          photo,
          photo_after,
          address,
          subdistrict,
          district,
          province,
          timestamp,
          state,
          star,
          count_reopen,
          last_activity,
          duration_minutes_inprogress,
          duration_minutes_finished,
          duration_minutes_total,
          timestamp_inprogress,
          timestamp_finished,
          view_count,
          total_point,
          likes,
          dislikes,
          ST_Distance_Sphere(
              point(
                  CAST(SUBSTRING_INDEX(coords, ',', 1) AS DECIMAL(10, 7)),
                  CAST(SUBSTRING_INDEX(coords, ',', -1) AS DECIMAL(10, 7))
              ),
              point(?, ?)
          ) AS distance
        FROM 
          traffy_data
        HAVING 
          distance < ?
        ORDER BY 
          distance
      `;
  
      // Fetch places within the radius
      const [places] = await pool.query(query, [lng, lat, radiusValue]);
  
      // Fetch review summaries for each place
      const enhancedPlaces = await Promise.all(
        places.map(async (place) => {
          const reviewQuery = `
            SELECT 
              COUNT(*) AS total_reviews,
              SUM(CASE WHEN review_status = 'pass' THEN 1 ELSE 0 END) AS pass_count,
              SUM(CASE WHEN review_status = 'fail' THEN 1 ELSE 0 END) AS fail_count,
              AVG(stars) AS average_stars
            FROM reviews
            WHERE place_id = ?
          `;
  
          const [reviewSummary] = await pool.query(reviewQuery, [place.id]);
  
          // Add review summary to the place data
          return {
            ...place,
            reviewSummary: reviewSummary[0], // Pass, fail, average stars
          };
        })
      );
  
      console.log(`Fetched ${enhancedPlaces.length} places with review summaries.`);
      res.json(enhancedPlaces);
    } catch (error) {
      console.error("Error fetching nearby places by coordinates:", error.message);
      res.status(500).json({
        error: "Internal server error",
        details: error.message,
      });
    }
  };

  const saveReview = async (req, res) => {
    try {
      const { placeId, userId, displayName, reviewStatus, stars, comment, timestamp } = req.body;
  
      // Validate required fields
      if (!placeId || !userId || !displayName || stars == null || !reviewStatus || !comment) {
        console.error("Missing required fields:", req.body);
        return res.status(400).json({ error: "Missing required fields" });
      }
  
      // Use current timestamp if not provided
      const reviewTimestamp = timestamp || new Date().toISOString();
  
      const query = `
        INSERT INTO reviews (
          place_id, user_id, display_name, review_status, stars, comment, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
  
      const [result] = await pool.query(query, [
        placeId,
        userId,
        displayName,
        reviewStatus,
        stars,
        comment,
        reviewTimestamp,
      ]);
  
      res.status(200).json({ message: "Review saved successfully", reviewId: result.insertId });
    } catch (error) {
      console.error("Error saving review:", error.message);
      res.status(500).json({ error: "Internal server error" });
    }
  };
  
  
  

export default {
    getNearbyPlacesByCoordinates,
    saveReview
};
