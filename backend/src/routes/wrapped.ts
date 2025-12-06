import { Router } from 'express';
import { db } from '../db/index.js';
import { users, messages, connections, wrappedCache } from '../db/schema.js';
import { eq, and, count, sql, desc, gte } from 'drizzle-orm';
import { aggregateTweetContent, generateWeeklyRecap } from '../services/llm.js';
import { extractUsername, fetchTwitterUser, fetchRecentTweets, TwitterTweet } from './twitter.js';

const router = Router();

// Constants
const HARDCODED_TWITTER_POSTS_FALLBACK = `[Post 1 - Dec 1]: Excited to share some updates on my latest projects and thoughts!
[Post 2 - Dec 2]: Had an amazing conversation with the team today about innovation and the future of technology.
[Post 3 - Dec 3]: Reflecting on the importance of building meaningful connections and staying authentic online.
[Post 4 - Dec 4]: Just finished reading an incredible book that changed my perspective on productivity and creativity.
[Post 5 - Dec 5]: Grateful for all the support and engagement from this amazing community.`;

const LLM_CONTEXT_TEMPLATE = (firstName: string, lastName: string, username?: string) => {
    // Don't include name if it's "Unknown User" (handle various formats)
    const isUnknownUser = (firstName === 'Unknown' && lastName === 'User') ||
        firstName === 'Unknown User' ||
        lastName === 'Unknown User' ||
        (firstName.trim() === '' && lastName.trim() === '');

    if (isUnknownUser) {
        // Only include username if available, otherwise generic context
        const userIdentifier = username ? `@${username}` : 'the user';
        return `This is a weekly recap for ${userIdentifier} based on their Twitter activity.`;
    }

    const userIdentifier = username
        ? `${firstName} ${lastName} (@${username})`
        : `${firstName} ${lastName}`;
    return `This is a weekly recap for ${userIdentifier} based on their Twitter activity.`;
};

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Cache TTL: 1 hour in milliseconds
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Helper function to generate Twitter wrapped data with fallback handling
 */
async function generateTwitterWrapped(
    user: { firstName: string; lastName: string },
    twitterUsername: string
) {
    let twitterUser = null;
    let tweets: TwitterTweet[] = [];
    let error: { type: string; message: string; retryAfter?: string | null } | null = null;

    // Try to fetch Twitter data - if ANY error occurs, use hardcoded fallback
    try {
        console.log(`📡 Attempting to fetch Twitter data for @${twitterUsername}`);
        twitterUser = await fetchTwitterUser(twitterUsername);
        console.log(`✅ Twitter user fetched: ${twitterUser ? twitterUser.username : 'null'}`);
        tweets = await fetchRecentTweets(twitterUsername, 7, 100);
        console.log(`✅ Tweets fetched: ${tweets.length} tweets`);
    } catch (err: any) {
        // ANY error (rate limit, API error, network error, etc.) = use hardcoded fallback
        const isRateLimit = err && (err.isRateLimit === true || err.isRateLimit === 'true');
        console.log('⚠️ Twitter API error caught in wrapped route, using hardcoded fallback');
        console.log('Error details:', {
            message: err?.message || err?.toString(),
            isRateLimit: isRateLimit,
            retryAfter: err?.retryAfter,
            errorType: err?.constructor?.name,
        });
        error = {
            type: isRateLimit ? 'rate_limit' : 'api_error',
            message: isRateLimit
                ? 'Twitter API rate limit exceeded. Using fallback content for recap.'
                : 'Failed to fetch Twitter data. Using fallback content for recap.',
            retryAfter: err?.retryAfter || null,
        };
        // Explicitly set to null/empty to ensure we use fallback
        twitterUser = null;
        tweets = [];
        console.log('✅ Error handled, fallback will be used for content');
    }

    // Use tweets if available, otherwise use hardcoded fallback
    const aggregatedContent = tweets.length > 0
        ? aggregateTweetContent(tweets)
        : HARDCODED_TWITTER_POSTS_FALLBACK;

    console.log(`📝 Using ${tweets.length > 0 ? 'actual tweets' : 'hardcoded fallback'} for recap generation`);

    // Generate weekly recap
    let weeklyRecap: string | null = null;
    try {
        const context = LLM_CONTEXT_TEMPLATE(
            user.firstName,
            user.lastName,
            twitterUser?.username
        );
        weeklyRecap = await generateWeeklyRecap({
            textContent: aggregatedContent,
            context,
            maxWords: 200,
        });
    } catch (llmError) {
        console.error('Error generating weekly recap:', llmError);
    }

    return {
        user: twitterUser ? {
            username: twitterUser.username,
            name: twitterUser.name,
            profileImageUrl: twitterUser.profile_image_url,
            verified: twitterUser.verified || false,
        } : null,
        weeklyRecap,
        error,
    };
}

/**
 * Calculate wrapped data for a user (extracted for reuse)
 */
async function calculateWrappedData(user: typeof users.$inferSelect) {
    // Get total message count (messages where user is the sender)
    const messageCount = await db
        .select({ count: count() })
        .from(messages)
        .where(eq(messages.userId, user.id));

    const totalMessages = messageCount[0]?.count || 0;
    const messagesSent = totalMessages;

    // Get messages received (messages where user's phone number appears in messageRecipients array)
    const messagesReceivedCount = await db
        .select({ count: count() })
        .from(messages)
        .where(sql`${sql.raw(`'${user.number.replace(/'/g, "''")}'`)} = ANY(${messages.messageRecipients})`);

    const messagesReceived = Number(messagesReceivedCount[0]?.count || 0);

    // Get top contacts by counting occurrences in messageRecipients arrays
    const allUserMessages = await db
        .select({
            messageRecipients: messages.messageRecipients,
        })
        .from(messages)
        .where(eq(messages.userId, user.id));

    const contactCounts = new Map<string, number>();
    allUserMessages.forEach(msg => {
        if (msg.messageRecipients) {
            msg.messageRecipients.forEach(phone => {
                contactCounts.set(phone, (contactCounts.get(phone) || 0) + 1);
            });
        }
    });

    const topContactsRaw = Array.from(contactCounts.entries())
        .map(([phone, count]) => ({ counterpartyPhone: phone, messageCount: count }))
        .sort((a, b) => b.messageCount - a.messageCount)
        .slice(0, 10);

    const adminNumber = process.env.SENDER_NUMBER || null;

    const topContacts = await Promise.all(
        topContactsRaw.map(async (contact) => {
            if (adminNumber && contact.counterpartyPhone === adminNumber) {
                return {
                    phoneNumber: contact.counterpartyPhone,
                    messageCount: contact.messageCount,
                    name: 'Your AI Friend Laura',
                };
            }

            const [contactUser] = await db
                .select({
                    firstName: users.firstName,
                    lastName: users.lastName,
                })
                .from(users)
                .where(eq(users.number, contact.counterpartyPhone))
                .limit(1);

            if (contactUser &&
                !(contactUser.firstName === 'Unknown' && contactUser.lastName === 'User')) {
                return {
                    phoneNumber: contact.counterpartyPhone,
                    messageCount: contact.messageCount,
                    name: `${contactUser.firstName} ${contactUser.lastName}`,
                };
            }

            return {
                phoneNumber: contact.counterpartyPhone,
                messageCount: contact.messageCount,
                name: null,
            };
        })
    );

    const messagesByDay = await db
        .select({
            dayOfWeek: sql<number>`EXTRACT(DOW FROM ${messages.timestamp})`,
            count: count(),
        })
        .from(messages)
        .where(eq(messages.userId, user.id))
        .groupBy(sql`EXTRACT(DOW FROM ${messages.timestamp})`)
        .orderBy(sql`EXTRACT(DOW FROM ${messages.timestamp})`);

    const messagesByHour = await db
        .select({
            hour: sql<number>`EXTRACT(HOUR FROM ${messages.timestamp})`,
            count: count(),
        })
        .from(messages)
        .where(eq(messages.userId, user.id))
        .groupBy(sql`EXTRACT(HOUR FROM ${messages.timestamp})`)
        .orderBy(sql`EXTRACT(HOUR FROM ${messages.timestamp})`);

    const dateRange = await db
        .select({
            firstMessage: sql<Date>`MIN(${messages.timestamp})`,
            lastMessage: sql<Date>`MAX(${messages.timestamp})`,
        })
        .from(messages)
        .where(eq(messages.userId, user.id));

    const connectionCount = await db
        .select({ count: count() })
        .from(connections)
        .where(eq(connections.userId, user.id));

    // Calculate new connections from the past week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const newConnectionsThisWeek = await db
        .select({
            connectedUser: users,
            connectionCreatedAt: connections.createdAt,
        })
        .from(connections)
        .innerJoin(users, eq(connections.connectedUserId, users.id))
        .where(
            and(
                eq(connections.userId, user.id),
                gte(connections.createdAt, oneWeekAgo)
            )
        );

    const newConnectionsCount = newConnectionsThisWeek.length;

    const avgMessageLength = await db
        .select({
            avgLength: sql<number>`AVG(LENGTH(${messages.messageText}))`,
        })
        .from(messages)
        .where(eq(messages.userId, user.id));

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

    let twitterWrapped = null;
    const twitterUsername = extractUsername(user.twitter);
    console.log('twitterUsername', twitterUsername);

    if (twitterUsername) {
        try {
            twitterWrapped = await generateTwitterWrapped(
                { firstName: user.firstName, lastName: user.lastName },
                twitterUsername
            );
        } catch (error) {
            console.error('❌ Unexpected error in generateTwitterWrapped:', error);
            twitterWrapped = null;
        }
    }

    return {
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
            newConnectionsThisWeek: newConnectionsCount,
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
        newConnections: newConnectionsThisWeek.map(conn => ({
            id: conn.connectedUser.id,
            firstName: conn.connectedUser.firstName,
            lastName: conn.connectedUser.lastName,
            number: conn.connectedUser.number,
            profilePicture: conn.connectedUser.profilePicture,
            connectionCreatedAt: conn.connectionCreatedAt?.toISOString() || null,
        })),
        breakdown: {
            topContacts: topContacts.map(contact => ({
                phoneNumber: contact.phoneNumber,
                messageCount: contact.messageCount,
                name: contact.name || null,
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
        twitterWrapped: twitterWrapped,
    };
}

/**
 * GET /api/wrapped/:phoneNumber
 * Get wrapped message statistics for a user by phone number (with caching)
 */
router.get('/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Find user by phone number
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.number, phoneNumber))
            .limit(1);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check cache first
        const [cached] = await db
            .select()
            .from(wrappedCache)
            .where(eq(wrappedCache.userId, user.id))
            .limit(1);

        const now = new Date();
        const cacheValid = cached && cached.lastUpdated &&
            (now.getTime() - new Date(cached.lastUpdated).getTime()) < CACHE_TTL_MS;

        // if (cacheValid && cached.data) {
        //     console.log(`✅ Returning cached wrapped data for user ${user.id}`);
        //     return res.json(cached.data as any);
        // }

        // Calculate wrapped data
        console.log(`🔄 Calculating wrapped data for user ${user.id}`);
        const wrappedData = await calculateWrappedData(user);

        // Store in cache (upsert)
        if (cached) {
            await db
                .update(wrappedCache)
                .set({
                    data: wrappedData as any,
                    lastUpdated: new Date(),
                })
                .where(eq(wrappedCache.userId, user.id));
        } else {
            await db
                .insert(wrappedCache)
                .values({
                    userId: user.id,
                    data: wrappedData as any,
                    lastUpdated: new Date(),
                });
        }

        res.json(wrappedData);
    } catch (error) {
        console.error('Error fetching wrapped statistics:', error);
        res.status(500).json({
            error: 'Failed to fetch wrapped statistics',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/wrapped/:phoneNumber/connections
 * Get wrapped data for all connections of a user
 */
router.get('/:phoneNumber/connections', async (req, res) => {
    try {
        const { phoneNumber } = req.params;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Find user by phone number
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.number, phoneNumber))
            .limit(1);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get all connections with connection createdAt
        const userConnections = await db
            .select({
                connectedUser: users,
                connectionCreatedAt: connections.createdAt,
            })
            .from(connections)
            .innerJoin(users, eq(connections.connectedUserId, users.id))
            .where(eq(connections.userId, user.id));

        // Get wrapped data for each connection (with caching)
        const connectionsWrapped = await Promise.all(
            userConnections.map(async ({ connectedUser }) => {
                // Check cache
                const [cached] = await db
                    .select()
                    .from(wrappedCache)
                    .where(eq(wrappedCache.userId, connectedUser.id))
                    .limit(1);

                const now = new Date();
                const cacheValid = cached && cached.lastUpdated &&
                    (now.getTime() - new Date(cached.lastUpdated).getTime()) < CACHE_TTL_MS;

                let wrappedData;
                if (cacheValid && cached.data) {
                    wrappedData = cached.data as any;
                } else {
                    wrappedData = await calculateWrappedData(connectedUser);
                    // Store in cache
                    if (cached) {
                        await db
                            .update(wrappedCache)
                            .set({
                                data: wrappedData as any,
                                lastUpdated: new Date(),
                            })
                            .where(eq(wrappedCache.userId, connectedUser.id));
                    } else {
                        await db
                            .insert(wrappedCache)
                            .values({
                                userId: connectedUser.id,
                                data: wrappedData as any,
                                lastUpdated: new Date(),
                            });
                    }
                }

                return {
                    user: {
                        id: connectedUser.id,
                        firstName: connectedUser.firstName,
                        lastName: connectedUser.lastName,
                        phoneNumber: connectedUser.number,
                        twitter: connectedUser.twitter,
                        profilePicture: connectedUser.profilePicture,
                    },
                    wrapped: wrappedData,
                    connectionCreatedAt: userConnections.find(c => c.connectedUser.id === connectedUser.id)?.connectionCreatedAt?.toISOString() || null,
                };
            })
        );

        res.json({
            connections: connectionsWrapped,
        });
    } catch (error) {
        console.error('Error fetching connections wrapped data:', error);
        res.status(500).json({
            error: 'Failed to fetch connections wrapped data',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
