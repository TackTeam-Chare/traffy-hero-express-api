import pool from '../../config/db.js';

const getNearbyPlacesByCoordinates = async (req, res) => {
  try {
    const {
      lat,
      lng,
      radius = 25000
    } = req.query;

    // Validate coordinates
    if (
      !lat ||
      !lng ||
      // biome-ignore lint/suspicious/noGlobalIsNan: <explanation>
      isNaN(Number(lat)) ||
      // biome-ignore lint/suspicious/noGlobalIsNan: <explanation>
      isNaN(Number(lng)) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res.status(400).json({
        error: "Invalid coordinates"
      });
    }

    // Ensure radius is a valid number
    let radiusValue = Number.parseInt(radius, 10);
    // biome-ignore lint/suspicious/noGlobalIsNan: <explanation>
    if (isNaN(radiusValue) || radiusValue <= 0) {
      radiusValue = 25000; // Default radius to 5000 meters
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

      // Enhance places with investigators and review summaries
      const enhancedPlaces = await Promise.all(
        places.map(async (place) => {
          // Fetch investigators
          const investigatorsQuery = `
            SELECT display_name 
            FROM reviews 
            WHERE place_id = ?
          `;
          const [investigators] = await pool.query(investigatorsQuery, [place.id]);
  
          // Fetch review summaries
          const reviewSummaryQuery = `
            SELECT 
              COUNT(*) AS total_reviews,
              SUM(CASE WHEN review_status = 'pass' THEN 1 ELSE 0 END) AS pass_count,
              SUM(CASE WHEN review_status = 'fail' THEN 1 ELSE 0 END) AS fail_count,
              AVG(stars) AS average_stars
            FROM reviews
            WHERE place_id = ?
          `;
          const [reviewSummary] = await pool.query(reviewSummaryQuery, [place.id]);
          
          const agreeCommentsQuery = `
          SELECT comment, display_name, timestamp 
          FROM reviews 
          WHERE place_id = ? AND review_status = 'pass'
        `;

        const disagreeCommentsQuery = `
          SELECT comment, display_name, timestamp 
          FROM reviews 
          WHERE place_id = ? AND review_status = 'fail'
        `;

        const [agreeComments] = await pool.query(agreeCommentsQuery, [place.id]);
        const [disagreeComments] = await pool.query(disagreeCommentsQuery, [place.id]);
          return {
            ...place,
            investigators: investigators.map((inv) => inv.display_name),
            reviewSummary: reviewSummary[0],
            agreeComments: agreeComments.map((row) => ({
              text: row.comment,
              user: row.display_name,
              timestamp: row.timestamp,
            })),
            disagreeComments: disagreeComments.map((row) => ({
              text: row.comment,
              user: row.display_name,
              timestamp: row.timestamp,
            })),
          };
        })
      );
  
      console.log(`Fetched ${enhancedPlaces.length} places with investigators and review summaries.`);
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
    const { placeId, userId, displayName, reviewStatus, stars, comment } = req.body;

    if (!placeId || !userId || !displayName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const imagePaths = req.files ? req.files.map(file => file.filename) : []; // เก็บ path ในฐานข้อมูล

    const query = `
      INSERT INTO reviews (place_id, user_id, display_name, review_status, stars, comment, image)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const queryParams = [
      placeId,
      userId,
      displayName,
      reviewStatus,
      stars || 0,
      comment || '',
      JSON.stringify(imagePaths),
    ];

    const [result] = await pool.query(query, queryParams);

    res.status(200).json({ message: 'Review saved successfully', reviewId: result.insertId });
  } catch (error) {
    console.error('Error saving review:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};



const getUserReviewHistory = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId parameter" });
    }

    const query = `
      SELECT 
        reviews.id AS review_id,
        reviews.place_id,
        reviews.display_name,
        reviews.review_status,
        reviews.stars,
        reviews.comment,
        reviews.timestamp,
        traffy_data.ticket_id,
        traffy_data.type,
        traffy_data.organization,
        traffy_data.address
      FROM 
        reviews
      INNER JOIN 
        traffy_data
      ON 
        reviews.place_id = traffy_data.id
      WHERE 
        reviews.user_id = ?
      ORDER BY 
        reviews.timestamp DESC
    `;

    const [results] = await pool.query(query, [userId]);

    res.status(200).json(results);
  } catch (error) {
    console.error("Error fetching user review history:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};



export default {
  getNearbyPlacesByCoordinates,
  saveReview,
  getUserReviewHistory
};