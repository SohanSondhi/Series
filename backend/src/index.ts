import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool, db } from './db/index.js';
import { initializeDatabase } from './db/init.js';
import { messages } from './db/schema.js';
import usersRouter from './routes/users.js';
import profileRouter from './routes/profile.js';
import wrappedRouter from './routes/wrapped.js';
import messagesRouter from './routes/messages.js';
import twitterRouter from './routes/twitter.js';
import sendRouter from './routes/send.js';
import { disconnectProducer } from './kafka/producer.js';
import { sql, count, desc } from 'drizzle-orm';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.use('/api/profile', profileRouter);
app.use('/api/wrapped', wrappedRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/twitter', twitterRouter);
app.use('/api/send', sendRouter);

// Start server
const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await disconnectProducer();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await disconnectProducer();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

