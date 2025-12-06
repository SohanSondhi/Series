import { Router } from 'express';
import { db } from '../db/index.js';
import { messages, users, messageCounterparties } from '../db/schema.js';
import { desc, eq, and, count, sql, inArray } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/messages
 * Get all messages with user information
 * Query params:
 *   - limit: number of messages to return (default: 100)
 *   - offset: offset for pagination (default: 0)
 *   - userId: filter by user ID (optional)
 *   - direction: filter by direction 'inbound' or 'outbound' (optional)
 */
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;
        const userId = req.query.userId ? parseInt(req.query.userId as string) : null;
        const direction = req.query.direction as string | null;

        // Build where conditions
        const conditions = [];
        if (userId) {
            conditions.push(eq(messages.userId, userId));
        }
        if (direction && (direction === 'inbound' || direction === 'outbound')) {
            conditions.push(eq(messages.direction, direction));
        }
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get messages with user info
        const query = db
            .select({
                id: messages.id,
                userId: messages.userId,
                messageText: messages.messageText,
                direction: messages.direction,
                timestamp: messages.timestamp,
                counterpartyPhone: messages.counterpartyPhone,
                createdAt: messages.createdAt,
                // User information
                userFirstName: users.firstName,
                userLastName: users.lastName,
                userNumber: users.number,
            })
            .from(messages)
            .leftJoin(users, eq(messages.userId, users.id))
            .orderBy(desc(messages.timestamp))
            .limit(limit)
            .offset(offset);

        const allMessages = whereClause
            ? await query.where(whereClause)
            : await query;

        // Get total count for pagination
        const countQuery = db
            .select({ count: sql<number>`count(*)` })
            .from(messages);

        const totalResult = whereClause
            ? await countQuery.where(whereClause)
            : await countQuery;

        const totalCount = Number(totalResult[0]?.count || 0);

        // Get all counterparties for the messages
        const messageIds = allMessages.map(msg => msg.id);
        const counterpartiesMap = new Map<number, string[]>();

        if (messageIds.length > 0) {
            const allCounterparties = await db
                .select({
                    messageId: messageCounterparties.messageId,
                    counterpartyPhone: messageCounterparties.counterpartyPhone,
                })
                .from(messageCounterparties)
                .where(inArray(messageCounterparties.messageId, messageIds));

            // Group counterparties by message ID
            for (const cp of allCounterparties) {
                if (!counterpartiesMap.has(cp.messageId)) {
                    counterpartiesMap.set(cp.messageId, []);
                }
                counterpartiesMap.get(cp.messageId)!.push(cp.counterpartyPhone);
            }
        }

        res.json({
            messages: allMessages.map(msg => ({
                id: msg.id,
                userId: msg.userId,
                user: msg.userFirstName && msg.userLastName
                    ? {
                        id: msg.userId,
                        firstName: msg.userFirstName,
                        lastName: msg.userLastName,
                        number: msg.userNumber,
                    }
                    : null,
                messageText: msg.messageText,
                direction: msg.direction,
                timestamp: msg.timestamp,
                counterpartyPhone: msg.counterpartyPhone, // Keep for backward compatibility
                counterpartyPhones: counterpartiesMap.get(msg.id) || [], // New: array of all counterparties
                createdAt: msg.createdAt,
            })),
            pagination: {
                total: totalCount,
                limit,
                offset,
                hasMore: offset + limit < totalCount,
            },
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({
            error: 'Failed to fetch messages',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

export default router;
