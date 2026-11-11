const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const apiRoutes = require('./routes/apiRoutes');

const app = express();
const PORT = Number(process.env.PORT || 5000);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded diagnostic evidence photos statically
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// API Routes
app.use('/api', apiRoutes);

// Root status endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'NorthPeak ServiceHub API',
    client: 'NorthPeak Aircon & Refrigeration System Trading',
    version: '1.0.0',
    status: 'Running'
  });
});

// Global error handler (including Multer upload errors)
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]:', err.message);
  return res.status(err.status || 400).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[NorthPeak ServiceHub Server] Listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
