import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db/index.js';
import { initializeDatabase } from './db/init.js';
import usersRouter from './routes/users.js';
import { sql } from 'drizzle-orm';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database on startup
initializeDatabase().catch(console.error);

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        // Test database connection
        await pool.query('SELECT NOW()');
        res.json({
            message: 'Server is running and database is connected!',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            message: 'Server is running but database connection failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// API Routes
app.use('/api/users', usersRouter);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

