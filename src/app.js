import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/user/userRoutes.js';
import http from 'http';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Get allowed origins from environment or use a default list
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:3000',
      'https://traffy-fondue.vercel.app',
      'https://ed9a-122-155-95-12.ngrok-free.app',
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
