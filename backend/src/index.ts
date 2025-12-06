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

// Test endpoint to check if messages are being ingested
app.get('/api/test/messages', async (req, res) => {
    try {
        const messageCount = await db
            .select({ count: count() })
            .from(messages);

        const recentMessages = await db
            .select()
            .from(messages)
            .orderBy(desc(messages.createdAt))
            .limit(10);

        res.json({
            totalMessages: messageCount[0]?.count || 0,
            recentMessages: recentMessages.map(msg => ({
                id: msg.id,
                userId: msg.userId,
                direction: msg.direction,
                text: msg.messageText.substring(0, 50) + (msg.messageText.length > 50 ? '...' : ''),
                timestamp: msg.timestamp,
                counterparty: msg.counterpartyPhone,
            })),
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch messages',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// API Routes
app.use('/api/users', usersRouter);
app.use('/api/profile', profileRouter);
app.use('/api/wrapped', wrappedRouter);
app.use('/api/messages', messagesRouter);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

