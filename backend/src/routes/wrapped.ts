import { Router } from 'express';
import { db } from '../db/index.js';
import { users, messages, connections } from '../db/schema.js';
import { eq, and, count, sql, desc } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/wrapped/:phoneNumber
 * Get wrapped message statistics for a user by phone number
 */
router.get('/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Normalize phone number (remove non-digits)
        const normalizedPhone = phoneNumber.replace(/\D/g, '');

        // Find user by phone number
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.number, normalizedPhone))
            .limit(1);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get message statistics
        const messageStats = await db
            .select({
                direction: messages.direction,
                count: count(),
            })
            .from(messages)
            .where(eq(messages.userId, user.id))
            .groupBy(messages.direction);

        // Calculate totals
        const messagesSent = messageStats.find(s => s.direction === 'outbound')?.count || 0;
        const messagesReceived = messageStats.find(s => s.direction === 'inbound')?.count || 0;
        const totalMessages = messagesSent + messagesReceived;

        // Get top contacts (people you messaged with most)
        const topContacts = await db
            .select({
                counterpartyPhone: messages.counterpartyPhone,
                messageCount: count(),
            })
            .from(messages)
            .where(eq(messages.userId, user.id))
            .groupBy(messages.counterpartyPhone)
            .orderBy(desc(count()))
            .limit(10);

        // Get messages by day of week
        const messagesByDay = await db
            .select({
                dayOfWeek: sql<number>`EXTRACT(DOW FROM ${messages.timestamp})`,
                count: count(),
            })
            .from(messages)
            .where(eq(messages.userId, user.id))
            .groupBy(sql`EXTRACT(DOW FROM ${messages.timestamp})`)
            .orderBy(sql`EXTRACT(DOW FROM ${messages.timestamp})`);

        // Get messages by hour of day
        const messagesByHour = await db
            .select({
                hour: sql<number>`EXTRACT(HOUR FROM ${messages.timestamp})`,
                count: count(),
            })
            .from(messages)
            .where(eq(messages.userId, user.id))
            .groupBy(sql`EXTRACT(HOUR FROM ${messages.timestamp})`)
            .orderBy(sql`EXTRACT(HOUR FROM ${messages.timestamp})`);

        // Get date range of messages
        const dateRange = await db
            .select({
                firstMessage: sql<Date>`MIN(${messages.timestamp})`,
                lastMessage: sql<Date>`MAX(${messages.timestamp})`,
            })
            .from(messages)
            .where(eq(messages.userId, user.id));

        // Get connection count
        const connectionCount = await db
            .select({ count: count() })
            .from(connections)
            .where(eq(connections.userId, user.id));

        // Get average message length
        const avgMessageLength = await db
            .select({
                avgLength: sql<number>`AVG(LENGTH(${messages.messageText}))`,
            })
            .from(messages)
            .where(eq(messages.userId, user.id));

        // Get longest message
        const longestMessage = await db
            .select({
                messageText: messages.messageText,
                length: sql<number>`LENGTH(${messages.messageText})`,
                timestamp: messages.timestamp,
            })
            .from(messages)
            .where(eq(messages.userId, user.id))
            .orderBy(desc(sql`LENGTH(${messages.messageText})`))
            .limit(1);

        // Get most active day (by message count)
        const mostActiveDay = await db
            .select({
                date: sql<Date>`DATE(${messages.timestamp})`,
                count: count(),
            })
            .from(messages)
            .where(eq(messages.userId, user.id))
            .groupBy(sql`DATE(${messages.timestamp})`)
            .orderBy(desc(count()))
            .limit(1);

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        res.json({
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.number,
            },
            statistics: {
                totalMessages,
                messagesSent,
                messagesReceived,
                connectionCount: connectionCount[0]?.count || 0,
                averageMessageLength: avgMessageLength[0]?.avgLength
                    ? Math.round(Number(avgMessageLength[0].avgLength))
                    : 0,
                longestMessage: longestMessage[0]
                    ? {
                        text: longestMessage[0].messageText,
                        length: Number(longestMessage[0].length),
                        timestamp: longestMessage[0].timestamp,
                    }
                    : null,
                dateRange: dateRange[0]
                    ? {
                        firstMessage: dateRange[0].firstMessage,
                        lastMessage: dateRange[0].lastMessage,
                    }
                    : null,
                mostActiveDay: mostActiveDay[0]
                    ? {
                        date: mostActiveDay[0].date,
                        messageCount: mostActiveDay[0].count,
                    }
                    : null,
            },
            breakdown: {
                topContacts: topContacts.map(contact => ({
                    phoneNumber: contact.counterpartyPhone,
                    messageCount: contact.messageCount,
                })),
                messagesByDayOfWeek: messagesByDay.map(day => ({
                    day: dayNames[Number(day.dayOfWeek)],
                    dayNumber: Number(day.dayOfWeek),
                    count: day.count,
                })),
                messagesByHour: messagesByHour.map(hour => ({
                    hour: Number(hour.hour),
                    count: hour.count,
                })),
            },
        });
    } catch (error) {
        console.error('Error fetching wrapped statistics:', error);
        res.status(500).json({
            error: 'Failed to fetch wrapped statistics',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
