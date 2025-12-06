import { KafkaEvent, MessageReceivedData } from './kafkaTypes.js';
import { sendMessage } from './producer.js';
import { db } from '../db/index.js';
import { users, connections, messages } from '../db/schema.js';
import { eq, desc, sql, and } from 'drizzle-orm';
import { generateWeeklyRecap } from '../services/llm.js';
import { generateTwitterWrapped } from '../routes/wrapped.js';
import { extractUsername } from '../routes/twitter.js';
import { storeWrappedConnections, WrappedConnection } from './createGc.js';

interface ConnectionSummary {
    name: string;
    firstName: string;
    phoneNumber: string;
    summary: string;
    isOldConnection: boolean;
}

/**
 * Get connection summaries for the wrapped message
 * Returns 2 top connections and 1 old connection the user hasn't talked to in a while
 */
export async function getConnectionSummaries(userPhone: string, useLLM: boolean): Promise<ConnectionSummary[]> {
    try {
        // Find the user
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.number, userPhone))
            .limit(1);

        if (!user) {
            console.log(`User not found for phone: ${userPhone}`);
            return [];
        }

        // Get all connections (just the user data, we'll use weeklyRecap from users table)
        const userConnections = await db
            .select({
                connectedUser: users,
            })
            .from(connections)
            .innerJoin(users, eq(connections.connectedUserId, users.id))
            .where(eq(connections.userId, user.id));

        if (userConnections.length === 0) {
            console.log(`No connections found for user: ${user.id}`);
            return [];
        }

        // Get message counts for each connection to find top and old connections
        const connectionStats = await Promise.all(
            userConnections.map(async ({ connectedUser }) => {
                // Count messages to/from this connection
                const messageCount = await db
                    .select({ count: sql<number>`count(*)` })
                    .from(messages)
                    .where(
                        and(
                            eq(messages.userId, user.id),
                            sql`${sql.raw(`'${connectedUser.number.replace(/'/g, "''")}'`)} = ANY(${messages.messageRecipients})`
                        )
                    );

                // Get most recent message timestamp
                const lastMessage = await db
                    .select({ timestamp: messages.timestamp })
                    .from(messages)
                    .where(
                        and(
                            eq(messages.userId, user.id),
                            sql`${sql.raw(`'${connectedUser.number.replace(/'/g, "''")}'`)} = ANY(${messages.messageRecipients})`
                        )
                    )
                    .orderBy(desc(messages.timestamp))
                    .limit(1);

                return {
                    connectedUser,
                    messageCount: Number(messageCount[0]?.count || 0),
                    lastMessageDate: lastMessage[0]?.timestamp || null,
                };
            })
        );

        // Filter connections that have a weeklyRecap
        const connectionsWithRecaps = connectionStats.filter(c => c.connectedUser.weeklyRecap);

        console.log(`📊 Found ${connectionStats.length} total connections, ${connectionsWithRecaps.length} with recaps`);
        connectionStats.forEach(c => {
            console.log(`   - ${c.connectedUser.firstName} ${c.connectedUser.lastName}: weeklyRecap="${c.connectedUser.weeklyRecap || 'EMPTY'}", messages=${c.messageCount}`);
        });

        if (connectionsWithRecaps.length === 0) {
            console.log('No connections with weekly recaps found');
            return [];
        }

        // Sort by message count (descending) to get top connections
        const sortedByMessageCount = [...connectionsWithRecaps].sort(
            (a, b) => b.messageCount - a.messageCount
        );

        // Sort by last message date (ascending) to find old connections
        const sortedByOldest = [...connectionsWithRecaps].sort((a, b) => {
            if (!a.lastMessageDate && !b.lastMessageDate) return 0;
            if (!a.lastMessageDate) return -1;
            if (!b.lastMessageDate) return 1;
            return new Date(a.lastMessageDate).getTime() - new Date(b.lastMessageDate).getTime();
        });

        const summaries: ConnectionSummary[] = [];

        // Get top 2 connections (most messages) and mark them as not old
        const topConnections = sortedByMessageCount.slice(0, 2).map(conn => ({
            ...conn,
            isOldConnection: false as const,
        }));

        // Get 1 old connection (hasn't talked to in a while)
        // Find one that's not already in top connections
        const topConnectionIds = new Set(topConnections.map(c => c.connectedUser.id));
        const oldConnection = sortedByOldest.find(c => !topConnectionIds.has(c.connectedUser.id));

        // Map old connection with isOldConnection flag
        const mappedOldConnection = oldConnection ? {
            ...oldConnection,
            isOldConnection: true as const,
        } : null;

        // Combine connections
        const combinedConnections = [...topConnections, ...(mappedOldConnection ? [mappedOldConnection] : [])];

        for (const conn of combinedConnections) {
            const isOldConnection = conn.isOldConnection;
            console.log(`📝 Generating summary for ${conn.connectedUser.firstName} ${conn.connectedUser.lastName} (useLLM: ${useLLM})`);
            let weeklyRecap: string;

            if (useLLM) {
                // Only update Twitter weekly recap if useLLM is true
                try {
                    const twitterUsername = extractUsername(conn.connectedUser.twitter);
                    console.log('twitterUsername', twitterUsername);

                    if (twitterUsername) {
                        try {
                            weeklyRecap = await generateTwitterWrapped(
                                { firstName: conn.connectedUser.firstName, lastName: conn.connectedUser.lastName },
                                twitterUsername
                            ).then(result => result.weeklyRecap || '');
                        } catch (error) {
                            console.error('Error getting weekly recap:', error);
                            weeklyRecap = conn.connectedUser.weeklyRecap || '';
                        }
                    } else {
                        weeklyRecap = conn.connectedUser.weeklyRecap || '';
                    }
                } catch (error) {
                    console.error('Error processing connection:', error);
                    weeklyRecap = conn.connectedUser.weeklyRecap || '';
                }
            } else {
                // If useLLM is false, just use existing weeklyRecap without updating
                // DO NOT call any LLM or Twitter API functions
                weeklyRecap = conn.connectedUser.weeklyRecap || '';
                console.log(`⚠️ useLLM is false - skipping LLM calls, using existing weeklyRecap: "${weeklyRecap || 'EMPTY'}"`);
            }

            const name = `${conn.connectedUser.firstName} ${conn.connectedUser.lastName}`;

            let shortSummary: string;
            if (useLLM && weeklyRecap) {
                // Generate a short 10-word summary from the weekly recap using LLM
                console.log('🤖 Calling LLM to generate short summary (useLLM=true)');
                shortSummary = await generateWeeklyRecap({
                    textContent: weeklyRecap,
                    maxWords: 10,
                });
                console.log('shortSummary', shortSummary);
            } else {
                // If useLLM is false or no weeklyRecap, use existing recap directly (NO LLM CALL)
                shortSummary = weeklyRecap || 'No summary available';
                console.log(`✅ Skipping LLM call (useLLM=${useLLM}), using existing summary: "${shortSummary}"`);
            }

            summaries.push({
                name,
                firstName: conn.connectedUser.firstName,
                phoneNumber: conn.connectedUser.number,
                summary: shortSummary,
                isOldConnection,
            });
        }


        return summaries;
    } catch (error) {
        console.error('Error getting connection summaries:', error);
        return [];
    }
}


/**
 * Format the connections summary section for the message
 */
function formatConnectionsSummary(summaries: ConnectionSummary[], wrappedUrl: string): string {
    let message = "Weekly recap! Here is what your connections have been up to:\n";

    if (summaries.length > 0) {
        summaries.forEach((summary, index) => {
            if (summary.isOldConnection) {
                message += `\n${index + 1}. ${summary.name} (been a while!) - ${summary.summary}`;
            } else {
                message += `\n${index + 1}. ${summary.name} - ${summary.summary}`;
            }
        });
    } else {
        message += "\n(No connection updates available this week)";
    }

    message += `\n\nSee your more in depth wrapped: ${wrappedUrl}`;

    return message;
}

/**
 * Improved detection for summary/wrapped requests
 * Checks for various keywords and phrases that indicate the user wants their wrapped/summary
 */
export async function determineIfSummaryRelated(event: KafkaEvent): Promise<boolean> {
    const data = event.data as MessageReceivedData;

    // Don't send a summary to the admin number
    if (data.from_phone === process.env.SENDER_NUMBER) {
        return false;
    }

    // Normalize text for case-insensitive matching
    const normalizedText = data.text.toLowerCase().trim();

    // Keywords that indicate a request for summary/wrapped
    const summaryKeywords = [
        'summary',
        'wrapped',
        'recap',
        'week summary',
        'my summary',
        'send summary',
        'show summary',
        'get summary',
        'give me summary',
        'can i get',
        'can you send',
        'send me',
        'show me',
        'my wrapped',
        'send wrapped',
        'show wrapped',
        'get wrapped',
        'give me wrapped',
        'week recap',
        'my recap',
        'send recap',
        'show recap',
        'get recap',
    ];

    // Check for exact keyword matches
    const hasKeyword = summaryKeywords.some(keyword => normalizedText.includes(keyword));

    // Check for question patterns asking for summary
    const questionPatterns = [
        /(can|could|would|will)\s+(you\s+)?(send|show|give|get)\s+(me\s+)?(a\s+)?(summary|wrapped|recap)/i,
        /(i\s+)?(want|need|would like)\s+(to\s+)?(see|get|have|view)\s+(my\s+)?(summary|wrapped|recap)/i,
        /(what|where)\s+(is|are)\s+(my\s+)?(summary|wrapped|recap)/i,
        /(show|send|give)\s+(me\s+)?(my\s+)?(summary|wrapped|recap)/i,
    ];

    const hasQuestionPattern = questionPatterns.some(pattern => pattern.test(data.text));

    // Check for imperative requests
    const imperativePatterns = [
        /^(send|show|give|get)\s+(me\s+)?(my\s+)?(summary|wrapped|recap)/i,
        /(summary|wrapped|recap)\s+(please|pls|now)/i,
    ];

    const hasImperativePattern = imperativePatterns.some(pattern => pattern.test(data.text));

    // Must have at least one indicator
    return hasKeyword || hasQuestionPattern || hasImperativePattern;
}



/**
 * Send a dynamic, conversational summary message based on the user's request
 */
export async function sendSummaryTextMessage(event: KafkaEvent): Promise<void> {
    const data = event.data as MessageReceivedData;

    // Generate the wrapped URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const wrappedUrl = `${frontendUrl}/wrapped/${data.from_phone}`;

    // Get connection summaries (useLLM: true to generate fresh Twitter recaps and summaries)
    const connectionSummaries = await getConnectionSummaries(data.from_phone, false);

    // Format the complete message
    const message = formatConnectionsSummary(connectionSummaries, wrappedUrl);
    console.log('message', message);

    await sendMessage([data.from_phone], message);

    // Store connections for potential group chat creation
    if (connectionSummaries.length > 0) {
        const wrappedConnections: WrappedConnection[] = connectionSummaries.map(summary => ({
            firstName: summary.firstName,
            fullName: summary.name,
            phoneNumber: summary.phoneNumber,
        }));
        storeWrappedConnections(data.from_phone, wrappedConnections);

        // Send follow-up message prompting for group chat
        const firstTwoNames = connectionSummaries.slice(0, 2).map(s => s.firstName);
        const gcPrompt = `Want to reconnect? Reply with names to start a group chat (e.g., '${firstTwoNames.join(', ')}')`;
        await sendMessage([data.from_phone], gcPrompt);
    }
}

/**
 * Format a dynamic summary message based on the user's request style
 */
function formatSummaryMessage(event: KafkaEvent): string {
    const data = event.data as MessageReceivedData;
    const normalizedText = data.text.toLowerCase().trim();

    // Normalize phone number for the URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const wrappedUrl = `${frontendUrl}/wrapped/${data.from_phone}`;

    // Determine the tone and style of response based on the user's message
    let responseMessage: string;

    // Check if user used casual/informal language
    const isCasual = /(hey|hi|yo|sup|what's up|wassup)/i.test(data.text) ||
        normalizedText.length < 20;

    // Check if user used formal language
    const isFormal = /(please|kindly|would you|could you|may i)/i.test(data.text);

    // Check if user seems excited
    const isExcited = /(!{2,}|woo|yay|awesome|cool|nice)/i.test(data.text);

    // Generate dynamic response based on context
    if (isCasual) {
        const casualResponses = [
            `Hey! Here's your wrapped: ${wrappedUrl}`,
            `Got it! Check out your week's summary here: ${wrappedUrl}`,
            `Here you go! Your wrapped is ready: ${wrappedUrl}`,
            `Sure thing! View your summary: ${wrappedUrl}`,
        ];
        responseMessage = casualResponses[Math.floor(Math.random() * casualResponses.length)];
    } else if (isFormal) {
        const formalResponses = [
            `Of course! Here's your weekly summary: ${wrappedUrl}`,
            `Certainly! You can view your wrapped here: ${wrappedUrl}`,
            `I'd be happy to share your summary: ${wrappedUrl}`,
        ];
        responseMessage = formalResponses[Math.floor(Math.random() * formalResponses.length)];
    } else if (isExcited) {
        const excitedResponses = [
            `Awesome! Here's your wrapped: ${wrappedUrl}`,
            `Exciting! Check out your week's summary: ${wrappedUrl}`,
            `Love the energy! Your wrapped is ready: ${wrappedUrl}`,
        ];
        responseMessage = excitedResponses[Math.floor(Math.random() * excitedResponses.length)];
    } else {
        // Default friendly responses
        const defaultResponses = [
            `Great! Here's your weekly summary: ${wrappedUrl}`,
            `Perfect! Your wrapped is ready: ${wrappedUrl}`,
            `Here's your week's recap: ${wrappedUrl}`,
            `Your summary is ready! View it here: ${wrappedUrl}`,
            `Check out your wrapped: ${wrappedUrl}`,
        ];
        responseMessage = defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
    }

    return responseMessage;
}