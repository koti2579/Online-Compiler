require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const path = require('path');
const { getBinaryStatuses } = require('./services/codeExecutor');

// Import routes
const authRoutes = require('./routes/auth');
const codeRoutes = require('./routes/code');
const fileRoutes = require('./routes/files');

const app = express();
// Trust the first proxy (Render/other reverse proxies)
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// Robust CORS configuration with whitelist and preflight support
const defaultFrontend = process.env.FRONTEND_URL || 'https://online-compiler-mauve.vercel.app';
const allowedOrigins = new Set([
  defaultFrontend,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (no origin)
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// Express 5: let cors middleware handle OPTIONS; provide graceful fallback
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Code execution rate limiting (more restrictive)
const codeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 code executions per minute
  message: 'Too many code execution requests, please try again later.'
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB connection (Mongoose 8+ defaults suffice; remove deprecated driver options)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/code-editor')
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/code', codeLimiter, codeRoutes);
app.use('/api/files', fileRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Compiler/binary availability endpoint
app.get('/api/health/binaries', async (req, res) => {
  try {
    const statuses = await getBinaryStatuses();
    res.json({ binaries: statuses });
  } catch (e) {
    res.status(500).json({ error: 'Binary check failed', message: e.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Log compiler availability at startup for visibility
  getBinaryStatuses()
    .then((statuses) => {
      console.log('Compiler availability:', statuses);
      const unavailable = statuses.filter(s => !s.available);
      if (unavailable.length) {
        console.warn('Some required runtimes are unavailable:');
        unavailable.forEach(s => {
          console.warn(`- ${s.name} at '${s.path}' unavailable: ${s.error || 'not found'}${s.hint ? `; hint: ${s.hint}` : ''}`);
        });
      }
    })
    .catch((e) => {
      console.warn('Failed to check compiler availability:', e.message);
    });
});