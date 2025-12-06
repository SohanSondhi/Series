import { Router } from 'express';
import { db } from '../db/index.js';
import { messages, users } from '../db/schema.js';
import { desc, eq, and, count, sql, inArray } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/messages
 * Get all messages with user information
 * Query params:
 *   - limit: number of messages to return (default: 100)
 *   - offset: offset for pagination (default: 0)
 *   - userId: filter by user ID (optional)
 */
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;
        const userId = req.query.userId ? parseInt(req.query.userId as string) : null;

        // Build where conditions
        const conditions = [];
        if (userId) {
            conditions.push(eq(messages.userId, userId));
        }
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get messages with user info and recipients array
        const query = db
            .select({
                id: messages.id,
                userId: messages.userId,
                messageText: messages.messageText,
                timestamp: messages.timestamp,
                messageRecipients: messages.messageRecipients,
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

        // Get user info for all unique recipient phone numbers
        const allRecipientPhones = new Set<string>();
        allMessages.forEach(msg => {
            if (msg.messageRecipients) {
                msg.messageRecipients.forEach(phone => allRecipientPhones.add(phone));
            }
        });

        const recipientUsersMap = new Map<string, {
            id: number;
            firstName: string;
            lastName: string;
            number: string;
        } | null>();

        if (allRecipientPhones.size > 0) {
            const recipientPhonesArray = Array.from(allRecipientPhones);
            // Query users by phone numbers
            const recipientUsers = await db
                .select({
                    id: users.id,
                    firstName: users.firstName,
                    lastName: users.lastName,
                    number: users.number,
                })
                .from(users)
                .where(inArray(users.number, recipientPhonesArray));

            for (const user of recipientUsers) {
                recipientUsersMap.set(user.number, user);
            }
        }

        res.json({
            messages: allMessages.map(msg => {
                const recipientPhones = msg.messageRecipients || [];
                const counterparties = recipientPhones.map(phone => {
                    const user = recipientUsersMap.get(phone);
                    return {
                        phoneNumber: phone,
                        userId: user?.id || null,
                        user: user || null,
                    };
                });

                return {
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
                    timestamp: msg.timestamp,
                    counterpartyPhone: recipientPhones[0] || null, // First recipient for backward compatibility
                    counterpartyPhones: recipientPhones, // Array of phone numbers for backward compatibility
                    counterparties: counterparties, // Full counterparty info with user details
                    createdAt: msg.createdAt,
                };
            }),
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
