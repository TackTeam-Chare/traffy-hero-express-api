import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/user/userRoutes.js';
import axios from 'axios'; // To handle HTTP requests
import http from 'http';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allowed origins for CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:3000',
      'https://traffy-fondue.vercel.app',
      'https://traffy-fondue-git-main-tackteam-chares-projects.vercel.app',
    ];

console.log('Initializing server...');
console.log('Allowed Origins:', allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`Blocked by CORS: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Handle Preflight Requests
app.options('*', cors());

// Body Parser Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Route to handle LINE Login callback
app.get('/line/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is missing' });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post('https://api.line.me/oauth2/v2.1/token', null, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      params: {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.LINE_CALLBACK_URL, // Set this in your .env file
        client_id: process.env.LINE_CLIENT_ID, // LINE Channel ID
        client_secret: process.env.LINE_CLIENT_SECRET, // LINE Channel Secret
      },
    });

    const { access_token, id_token } = tokenResponse.data;

    // Decode ID Token to get user profile
    const userInfo = await axios.get('https://api.line.me/v2/profile', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    res.status(200).json({
      message: 'LINE Login successful',
      profile: userInfo.data,
    });
  } catch (error) {
    console.error('Error during LINE Login callback:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to handle LINE Login callback' });
  }
});

// User Routes
app.use('/', userRoutes);

// Global Error-Handling Middleware
app.use((err, req, res, next) => {
  console.error('Error caught in middleware:', err);
  res.status(500).json({
    message: 'Internal server error',
    error: err.message,
  });
});

// HTTP Server
const server = http.createServer(app);

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle Unhandled Promise Rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Catch Uncaught Exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});
