import pool from '../../config/db.js';

const getNearbyPlacesByCoordinates = async (req, res) => {
    try {
        const { lat, lng, radius = 500 } = req.query;

        // Validate coordinates
        if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng)) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
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

        // Execute the query
        const [rows] = await pool.query(query, [lng, lat, radiusValue]);

        console.log(`Fetched ${rows.length} places within the radius.`);

        // Return results directly without modifying `photo` or `photo_after`
        res.json(rows);
    } catch (error) {
        console.error("Error fetching nearby places by coordinates:", error.message);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
};

export default {
    getNearbyPlacesByCoordinates,
};
