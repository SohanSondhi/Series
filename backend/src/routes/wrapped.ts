import { Router } from 'express';
import { db } from '../db/index.js';
import { users, messages, connections } from '../db/schema.js';
import { eq, and, count, sql, desc } from 'drizzle-orm';
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
    const userIdentifier = username
        ? `${firstName} ${lastName} (@${username})`
        : `${firstName} ${lastName}`;
    return `This is a weekly recap for ${userIdentifier} based on their Twitter activity.`;
};

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

        // Get top contacts
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

        // Get most active day
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

        // Get Twitter wrapped data if user has Twitter username
        let twitterWrapped = null;
        const twitterUsername = extractUsername(user.twitter);

        console.log(`🔍 Twitter wrapped check - user.twitter: ${user.twitter}, extracted username: ${twitterUsername}`);

        if (twitterUsername) {
            try {
                console.log(`🔄 Generating Twitter wrapped for @${twitterUsername}`);
                twitterWrapped = await generateTwitterWrapped(
                    { firstName: user.firstName, lastName: user.lastName },
                    twitterUsername
                );
                console.log(`✅ Twitter wrapped generated successfully`);
                console.log(`📝 Twitter wrapped weeklyRecap: ${twitterWrapped?.weeklyRecap ? 'Present' : 'Missing'}`);
                console.log(`📝 Twitter wrapped error: ${twitterWrapped?.error ? JSON.stringify(twitterWrapped.error) : 'None'}`);
            } catch (error) {
                console.error('❌ Unexpected error in generateTwitterWrapped:', error);
                // Even if there's an unexpected error, set twitterWrapped to null
                // so the response doesn't fail
                twitterWrapped = null;
            }
        } else {
            console.log(`⚠️ No Twitter username found for user ${user.firstName} ${user.lastName} (phone: ${user.phoneNumber})`);
        }

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
            twitterWrapped: twitterWrapped,
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
