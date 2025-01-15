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

        const distanceInMeters = place.distance;
        const kilometers = Math.floor(distanceInMeters / 1000); // จำนวนกิโลเมตร
        const meters = Math.round(distanceInMeters % 1000); // จำนวนเมตรที่เหลือ
        return {
          ...place,
          distanceFormatted: `${kilometers} กม. ${meters} ม.`, 
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
    const {
      placeId,
      userId,
      displayName,
      reviewStatus,
      stars,
      comment,
      lat,
      lng
    } = req.body;

    if (!placeId || !userId || !displayName || !lat || !lng) {
      console.log("🚨 Invalid data received:", { placeId, userId, lat, lng });
      return res.status(400).json({
        error: 'Missing required fields or invalid latitude/longitude'
      });
    }

    const latitude = Number.parseFloat(lat);
    const longitude = Number.parseFloat(lng);

    if (
      Number.
      isNaN(latitude) || Number.isNaN(longitude) ||
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180
    ) {
      console.log("🚨 Invalid Latitude or Longitude:", { lat, lng });
      return res.status(400).json({
        error: 'Latitude and Longitude must be valid numbers within proper range'
      });
    }

    // 🖼️ เก็บ path รูปภาพ
    const imagePaths = req.files ? req.files.map(file => file.filename) : [];

    // 📍 ดึงพิกัดสถานที่จาก Database
    const [placeData] = await pool.query(`
      SELECT coords 
      FROM traffy_data 
      WHERE id = ?
    `, [placeId]);

    if (!placeData.length || !placeData[0].coords) {
      return res.status(400).json({ error: 'Invalid place coordinates' });
    }

    // แยก coords และเรียงให้ถูกต้อง (lng, lat)
    const [placeLng, placeLat] = placeData[0].coords.split(',').map(Number);

    console.log("🛰️ User Coordinates:", { latitude, longitude });
    console.log("📍 Place Coordinates (Correct Order):", { placeLat, placeLng });

    // 📏 คำนวณระยะทาง
    const [distanceResult] = await pool.query(`
      SELECT ST_Distance_Sphere(
        POINT(?, ?), -- User Coordinates (lng, lat)
        POINT(?, ?)  -- Place Coordinates (lng, lat)
      ) AS distance
    `, [longitude, latitude, placeLng, placeLat]);

    const distance = distanceResult[0]?.distance || 0;
    console.log("📏 Distance Calculated:", distance);

    // 🧮 คำนวณแต้ม
    const basePoints = 10;
    const distancePoints = Math.round(distance / 1000);
    const commentPoints = comment ? 5 : 0;
    const imagePoints = imagePaths.length * 3;

    const totalPoints = basePoints + distancePoints + commentPoints + imagePoints;

    console.log("🏆 Total Points Earned:", totalPoints);

    // 📝 บันทึกรีวิว
    await pool.query(`
      INSERT INTO reviews (place_id, user_id, display_name, review_status, stars, comment, image, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      placeId,
      userId,
      displayName,
      reviewStatus,
      stars || 0,
      comment || '',
      JSON.stringify(imagePaths)
    ]);

    // 💎 อัปเดตคะแนนผู้ใช้
    await pool.query(`
      INSERT INTO user_points (user_id, points)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE points = points + ?;
    `, [userId, totalPoints, totalPoints]);

    res.status(200).json({
      message: 'Review saved successfully',
      pointsEarned: totalPoints,
      distance: distance.toFixed(2),
      commentPoints,
      imagePoints,
    });

  } catch (error) {
    console.error('🚨 Error saving review:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};

const getUserReviewHistory = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        error: "Missing userId parameter"
      });
    }

    const query = `
     SELECT 
        reviews.id AS review_id,
        reviews.place_id,
        reviews.display_name,
        reviews.review_status,
        reviews.stars,
        reviews.comment,
        reviews.timestamp AS user_review_timestamp,
        reviews.image AS user_uploaded_images,
        traffy_data.ticket_id,
        traffy_data.type,
        traffy_data.organization,
        traffy_data.address,
        traffy_data.district,
        traffy_data.subdistrict,
        traffy_data.province,
        traffy_data.state,
        traffy_data.photo AS photo_before,
        traffy_data.photo_after AS photo_after,
        traffy_data.duration_minutes_total,
        traffy_data.timestamp,
        traffy_data.timestamp_inprogress,
        traffy_data.timestamp_finished,
        traffy_data.likes,
        traffy_data.dislikes,
        traffy_data.view_count
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

    // ตรวจสอบ JSON String
    const formattedResults = results.map(item => ({
      ...item,
      user_uploaded_images: (() => {
        try {
          return item.user_uploaded_images
            ? JSON.parse(item.user_uploaded_images)
            : [];
        } catch (error) {
          console.error("Invalid JSON in user_uploaded_images:", item.user_uploaded_images);
          return item.user_uploaded_images 
            ? [item.user_uploaded_images] 
            : [];
        }
      })(),
    }));


    res.status(200).json(formattedResults);
  } catch (error) {
    console.error("Error fetching user review history:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
};


const searchPlaces = async (req, res) => {
  try {
    const {
      searchTerm,
      caseType,
      notInvestigated,
      finishedDate,
      lat,
      lng,
      radius = 25000
    } = req.query;

    let query = `
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
        district,
        address,
        state,
        star,
        timestamp,
        timestamp_finished,
        ST_Distance_Sphere(
          point(
            CAST(SUBSTRING_INDEX(coords, ',', 1) AS DECIMAL(10, 7)),
            CAST(SUBSTRING_INDEX(coords, ',', -1) AS DECIMAL(10, 7))
          ),
          point(?, ?)
        ) AS distance
      FROM traffy_data
      WHERE 1=1
    `;

    const queryParams = [lng, lat];

    // 🔍 กรองตามคำค้นหา
    if (searchTerm) {
      // biome-ignore lint/style/noUnusedTemplateLiteral: <explanation>
      query += ` AND (ticket_id LIKE ? OR comment LIKE ? OR organization LIKE ?)`;
      queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    }

    // 🔍 กรองตามประเภท
    if (caseType) {
      // biome-ignore lint/style/noUnusedTemplateLiteral: <explanation>
      query += ` AND type = ?`;
      queryParams.push(caseType);
    }

    // ✅ กรองตามสถานะยังไม่ตรวจสอบ
    if (notInvestigated === 'true') {
      query += ` AND state != 'finish'`;
    } else {
      query += ` AND state = 'finish'`;
    }


    // 📅 กรองตามวันที่เสร็จสิ้น
    if (finishedDate) {
      // biome-ignore lint/style/noUnusedTemplateLiteral: <explanation>
      query += ` AND DATE(timestamp_finished) = ?`;
      queryParams.push(finishedDate);
    }

    // biome-ignore lint/style/noUnusedTemplateLiteral: <explanation>
    query += ` HAVING distance < ? ORDER BY distance`;
    queryParams.push(Number(radius));

    const [results] = await pool.query(query, queryParams);

    res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching filtered places:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};

const getAllCategories = async (req, res) => {
  try {
    const query = `
      SELECT id, name 
      FROM categories 
      ORDER BY name ASC
    `;
    const [categories] = await pool.query(query);

    res.status(200).json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error.message);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

const getUserDashboard = async (req, res) => {
  try {
    const { userId } = req.params;

    // ตรวจสอบว่ามี userId หรือไม่
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // ดึงคะแนนและเหรียญตราจากตาราง user_points
    const [pointsResult] = await pool.query(
      "SELECT points  FROM user_points WHERE user_id = ?",
      [userId]
    );

    // ตรวจสอบว่าพบข้อมูลหรือไม่
    if (pointsResult.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      points: pointsResult[0]?.points || 0,
    });
  } catch (error) {
    console.error("🚨 Error fetching user dashboard:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
};


export default {
  getNearbyPlacesByCoordinates,
  saveReview,
  getUserReviewHistory,
  searchPlaces,
  getAllCategories,
  getUserDashboard
};