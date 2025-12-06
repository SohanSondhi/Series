import { Kafka } from 'kafkajs';
import dotenv from 'dotenv';
import { db } from '../db/index.js';
import { users, messages, connections, messageCounterparties } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { sendMessage } from './producer.js';

dotenv.config();

// Series API Configuration
const SERIES_API_BASE = process.env.SERIES_API_BASE;
const SERIES_API_KEY = process.env.SERIES_API_KEY;
const SENDER_NUMBER = process.env.SENDER_NUMBER;



// Validate required Kafka environment variables
const requiredKafkaVars = ['KAFKA_SASL_USERNAME', 'KAFKA_SASL_PASSWORD', 'KAFKA_BROKERS', 'KAFKA_TOPIC'];
const missingVars = requiredKafkaVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing required Kafka environment variables:', missingVars.join(', '));
    console.error('Please set these in your .env file or docker-compose.yml');
    process.exit(1);
}

// Kafka Configuration
const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID!,
    brokers: process.env.KAFKA_BROKERS!.split(','),
    ssl: process.env.KAFKA_TLS_ENABLED !== 'false',
    sasl: {
        mechanism: 'plain',
        username: process.env.KAFKA_SASL_USERNAME!,
        password: process.env.KAFKA_SASL_PASSWORD!,
    },
});

const consumer = kafka.consumer({
    groupId: process.env.KAFKA_CONSUMER_GROUP!,
    sessionTimeout: 30000, // 30 seconds
    heartbeatInterval: 3000, // 3 seconds
    maxInFlightRequests: 1, // Process one message at a time to ensure order
    allowAutoTopicCreation: false, // Don't auto-create topics
    retry: {
        retries: 8,
        initialRetryTime: 100,
        multiplier: 2,
        maxRetryTime: 30000,
    },
    // Auto-commit configuration
    // KafkaJS auto-commits by default, but we can configure it
    // The offset is committed after each message is processed successfully
});

// Kafka event structure based on Series iMessage Service API
interface ChatHandle {
    display_name?: string;
    identifier: string; // Phone number in E.164 format
}

interface MessageReceivedData {
    attachments?: any[];
    chat_handles: ChatHandle[];
    chat_id: string;
    from_phone: string;
    id: string;
    is_read: boolean;
    reaction_id?: string | null;
    sent_at: string; // Format: "2025-12-05 14:42:05 -0600"
    service: string;
    text: string;
}

interface KafkaEvent {
    api_version?: string;
    created_at?: string;
    data: MessageReceivedData | any;
    event_id?: string;
    event_type: string; // "message.received", "typing_indicator.received", etc.
}

/**
 * Upsert a user based on phone number
 * If user exists, update it; if not, create it
 */
async function upsertUser(phoneNumber: string): Promise<number> {
    if (!phoneNumber) {
        throw new Error('Phone number is required');
    }

    // Normalize phone number (remove any formatting)
    const normalizedPhone = phoneNumber.replace(/\D/g, '');

    // Try to find existing user
    const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.number, normalizedPhone))
        .limit(1);

    if (existingUser) {
        // Update existing user's updatedAt timestamp
        await db
            .update(users)
            .set({ updatedAt: new Date() })
            .where(eq(users.id, existingUser.id));
        return existingUser.id;
    } else {
        // Create new user with minimal info (name will be updated later if available)
        const [newUser] = await db
            .insert(users)
            .values({
                firstName: 'Unknown',
                lastName: 'User',
                number: normalizedPhone,
            })
            .returning();
        return newUser.id;
    }
}

/**
 * Insert a message into the database with multiple counterparties
 */
async function insertMessage(
    userId: number,
    messageText: string,
    direction: 'inbound' | 'outbound',
    timestamp: Date,
    counterpartyPhones: string[],
    chatId?: string | null
): Promise<number> {
    // Insert the message
    const [insertedMessage] = await db.insert(messages).values({
        userId,
        messageText,
        direction,
        timestamp,
        counterpartyPhone: counterpartyPhones.length > 0 ? counterpartyPhones[0] : null, // Keep for backward compatibility
        chatId: chatId || null,
    }).returning({ id: messages.id });

    const messageId = insertedMessage.id;

    // Insert all counterparties into the message_counterparties table
    if (counterpartyPhones.length > 0) {
        await db.insert(messageCounterparties).values(
            counterpartyPhones.map(phone => ({
                messageId,
                counterpartyPhone: phone,
            }))
        );
    }

    return messageId;
}

/**
 * Update connections between users based on message counterparty
 */
async function updateConnection(userId: number, counterpartyPhone?: string): Promise<void> {
    if (!counterpartyPhone) {
        return;
    }

    try {
        // Find the counterparty user
        const normalizedCounterparty = normalizePhoneNumber(counterpartyPhone);
        const [counterpartyUser] = await db
            .select()
            .from(users)
            .where(eq(users.number, normalizedCounterparty))
            .limit(1);

        if (!counterpartyUser) {
            // Counterparty doesn't exist yet, skip connection creation
            return;
        }

        // Check if connection already exists (bidirectional check)
        const [existingConnection] = await db
            .select()
            .from(connections)
            .where(
                and(
                    eq(connections.userId, userId),
                    eq(connections.connectedUserId, counterpartyUser.id)
                )
            )
            .limit(1);

        if (!existingConnection) {
            // Create connection (only one direction needed, as we can query both ways)
            try {
                await db.insert(connections).values({
                    userId,
                    connectedUserId: counterpartyUser.id,
                });
            } catch (error: any) {
                // Handle unique constraint violation (23505) - connection might have been created by another process
                if (error.code === '23505') {
                    // Connection already exists, that's fine
                    return;
                }
                throw error; // Re-throw other errors
            }
        }
    } catch (error) {
        // Log error but don't fail the message processing
        console.error('Error updating connection:', error);
    }
}

/**
 * Normalize phone number to digits only (consistent with database storage)
 * Removes all non-digit characters including + prefix
 */
function normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters (consistent with upsertUser)
    return phone.replace(/\D/g, '');
}

/**
 * Check if a phone number is the admin/service number
 */
function isAdmin(phoneNumber: string): boolean {
    if (!process.env.SENDER_NUMBER) {
        return false;
    }
    return normalizePhoneNumber(phoneNumber) === normalizePhoneNumber(process.env.SENDER_NUMBER);
}

/**
 * Analyze text to determine if it's related to wrapped/recap
 */
function isWrappedRelated(text: string): boolean {
    if (!text) return false;

    const lowerText = text.toLowerCase();

    // Keywords that indicate interest in wrapped/recap
    const wrappedKeywords = [
        'wrapped',
        'recap',
        'summary',
        'weekly recap',
        'my recap',
        'send me recap',
        'send recap',
        'get recap',
        'show me recap',
        'my summary',
        'send summary',
        'get summary',
        'weekly summary',
        'my stats',
        'send stats',
        'get stats',
        'my data',
        'send data'
    ];

    // Check if any keyword is present
    return wrappedKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Fetch chat data from Series API by chat ID
 */
async function fetchChatById(chatId: string): Promise<any | null> {
    if (!SERIES_API_BASE || !SERIES_API_KEY) {
        console.warn('⚠️ Series API not configured (SERIES_API_BASE or SERIES_API_KEY missing), cannot fetch chat');
        return null;
    }

    try {
        const response = await fetch(`${SERIES_API_BASE}/api/chats/${chatId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${SERIES_API_KEY}`,
                'accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.warn(`⚠️ Failed to fetch chat ${chatId}: ${response.status}`);
            return null;
        }

        const chatData = await response.json();
        return chatData;
    } catch (error) {
        console.error(`❌ Error fetching chat ${chatId}:`, error);
        return null;
    }
}

/**
 * Process a message.received event
 */
async function processMessageReceived(event: KafkaEvent): Promise<void> {
    try {
        const data = event.data as MessageReceivedData;

        if (!data.from_phone || !data.text) {
            console.warn('Message missing required fields, skipping:', event);
            return;
        }

        const fromPhone = normalizePhoneNumber(data.from_phone);
        const senderNumber = normalizePhoneNumber(SENDER_NUMBER || '');

        // Try to fetch chat data from Series API if we have a chat_id
        let chatData: any | null = null;
        let chatParticipants: string[] = [];
        let adminPhone: string | null = null;

        if (data.chat_id) {
            console.log(`🔍 Fetching chat data for chat_id: ${data.chat_id}`);
            chatData = await fetchChatById(data.chat_id);

            if (chatData) {
                // Extract participants from chat data
                const chatHandles = chatData.chat_handles || chatData.data?.chat_handles || [];
                chatParticipants = chatHandles.map((h: any) => normalizePhoneNumber(h.phone_number || h.identifier));

                // Find admin phone in chat participants
                adminPhone = chatParticipants.find((p: string) => p === senderNumber) || null;

                console.log(`✅ Chat participants: ${chatParticipants.join(', ')}`);
                console.log(`✅ Admin phone in chat: ${adminPhone || 'not found'}`);
            }
        }

        // Fallback to chat_handles from Kafka event if we don't have chat data
        if (!chatData && data.chat_handles) {
            chatParticipants = data.chat_handles.map(h => normalizePhoneNumber(h.identifier));
            const adminHandle = data.chat_handles.find(h => isAdmin(h.identifier));
            adminPhone = adminHandle ? normalizePhoneNumber(adminHandle.identifier) : null;
        }

        // Determine direction based on whether from_phone is the sender (admin) or not
        // If from_phone matches our sender number, it's outbound (we're sending)
        // Otherwise, it's inbound (someone is sending to us)
        const direction: 'inbound' | 'outbound' = fromPhone === senderNumber ? 'outbound' : 'inbound';

        // Determine which user this message belongs to
        // For inbound: the user is the sender (from_phone) - someone sending TO us
        // For outbound: the user is the admin (sender) - we're sending TO someone
        const userPhone = direction === 'inbound' ? fromPhone : senderNumber;

        // Determine counterparties based on direction and chat participants
        // A message can have multiple counterparties (group chats)
        let counterpartyPhones: string[] = [];

        if (direction === 'inbound') {
            // For inbound: user is sending TO us, so counterparty is us (sender/admin)
            if (senderNumber) {
                counterpartyPhones = [senderNumber];
            }
        } else {
            // For outbound: we're sending TO someone else(s)
            // Find all other participants (not us, not the sender if different)
            const otherParticipants = chatParticipants.filter((p: string) =>
                p !== senderNumber && p !== fromPhone
            );

            if (otherParticipants.length > 0) {
                counterpartyPhones = otherParticipants;
            } else if (data.chat_handles) {
                // Fallback to chat_handles if we don't have chat participants
                const counterpartyHandles = data.chat_handles
                    .filter(h => {
                        const normalized = normalizePhoneNumber(h.identifier);
                        return !isAdmin(h.identifier) && normalized !== senderNumber && normalized !== fromPhone;
                    })
                    .map(h => normalizePhoneNumber(h.identifier));
                counterpartyPhones = counterpartyHandles;
            }
        }

        // Parse timestamp from sent_at (format: "2025-12-05 14:42:05 -0600")
        let messageTimestamp: Date;
        try {
            if (data.sent_at) {
                // Parse the timestamp string
                messageTimestamp = new Date(data.sent_at);
                // If parsing fails, fall back to created_at or now
                if (isNaN(messageTimestamp.getTime())) {
                    messageTimestamp = event.created_at ? new Date(event.created_at) : new Date();
                }
            } else {
                messageTimestamp = event.created_at ? new Date(event.created_at) : new Date();
            }
        } catch {
            messageTimestamp = new Date();
        }

        // Upsert user based on the phone number
        const userId = await upsertUser(userPhone);

        // Insert message with all counterparties
        const messageId = await insertMessage(
            userId,
            data.text,
            direction,
            messageTimestamp,
            counterpartyPhones,
            data.chat_id ? String(data.chat_id) : null
        );

        // Update connections for all counterparties
        for (const counterpartyPhone of counterpartyPhones) {
            if (counterpartyPhone && counterpartyPhone !== userPhone) {
                // Create connection between user and counterparty
                await updateConnection(userId, counterpartyPhone);

                // Also ensure counterparty user exists and create reverse connection
                try {
                    const counterpartyUserId = await upsertUser(counterpartyPhone);
                    await updateConnection(counterpartyUserId, userPhone);
                } catch (error) {
                    console.error('Error creating counterparty connection:', error);
                }
            }
        }

        // Check if this is an inbound message (user sending TO our service number) and if it's wrapped-related
        if (direction === 'inbound') {
            // For inbound messages, someone is sending TO us
            // Verify that our sender number is in the chat participants
            const isToServiceNumber = chatParticipants.includes(senderNumber) ||
                (data.chat_handles?.some(h =>
                    normalizePhoneNumber(h.identifier) === senderNumber
                ) ?? false);

            if (isToServiceNumber) {
                // Analyze if the text is related to wrapped/recap
                if (isWrappedRelated(data.text)) {
                    console.log(`🎯 Detected wrapped-related message from user ${userPhone}`);

                    // Generate the wrapped link
                    const wrappedLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/wrapped/${userPhone}`;
                    const replyMessage = `Awesome, we'll send you your weekly recap. Here is the link: ${wrappedLink}`;

                    // Send reply message back to the user
                    try {
                        // Use the original phone number format from from_phone
                        const recipientPhone = data.from_phone.startsWith('+')
                            ? data.from_phone
                            : `+${data.from_phone}`;
                        console.log(`🔍 Recipient phone: ${recipientPhone}`);

                        await sendMessage([recipientPhone], replyMessage);
                        console.log(`✅ Sent wrapped reply to ${recipientPhone}`);
                    } catch (error) {
                        console.error('❌ Error sending wrapped reply:', error);
                    }


                }
            }
        }

        console.log(`✅ Processed ${direction} message: user=${userPhone}, counterparties=[${counterpartyPhones.join(', ') || 'N/A'}], text="${data.text.substring(0, 50)}${data.text.length > 50 ? '...' : ''}"`);
    } catch (error) {
        // Catch any errors in processMessageReceived and log them
        // This prevents the error from stopping the consumer
        console.error('❌ Error in processMessageReceived:', error);
        console.error('Error details:', error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
        } : error);
        console.error('Event data:', JSON.stringify(event, null, 2));
        // Re-throw so the caller knows there was an error
        // The caller (processEvent or eachMessage) will handle it
        throw error;
    }
}

/**
 * Process a Kafka event (can be message.received, typing_indicator, etc.)
 */
async function processEvent(event: KafkaEvent): Promise<void> {
    // Only process message.received events for now
    if (event.event_type === 'message.received') {
        // Don't wrap in try-catch here - let errors bubble up to the caller
        // The caller will handle errors and continue processing
        await processMessageReceived(event);
    } else {
        // Log other event types but don't process them
        console.log(`ℹ️  Skipping event type: ${event.event_type}`);
    }
}

/**
 * Start consuming messages from Kafka
 * This function will keep retrying if there are connection issues
 */
export async function startKafkaIngestor(): Promise<void> {

    console.log('🔧 Kafka Configuration:');
    console.log(`   Client ID: ${process.env.KAFKA_CLIENT_ID || 'default'}`);
    console.log(`   Brokers: ${process.env.KAFKA_BROKERS}`);
    console.log(`   Consumer Group: ${process.env.KAFKA_CONSUMER_GROUP || 'default'}`);
    console.log(`   Topic: ${process.env.KAFKA_TOPIC}`);
    console.log(`   SASL Username: ${process.env.KAFKA_SASL_USERNAME ? '***' + process.env.KAFKA_SASL_USERNAME.slice(-4) : 'NOT SET'}`);
    console.log(`   SASL Password: ${process.env.KAFKA_SASL_PASSWORD ? '***SET***' : 'NOT SET'}`);
    console.log(`   TLS Enabled: ${process.env.KAFKA_TLS_ENABLED !== 'false'}`);
    console.log('');

    await consumer.connect();
    console.log('✅ Connected to Kafka');

    // Set up error handlers
    consumer.on(consumer.events.CONNECT, () => {
        console.log('🔌 Kafka consumer connected');
    });

    consumer.on(consumer.events.DISCONNECT, () => {
        console.warn('⚠️ Kafka consumer disconnected');
    });

    consumer.on(consumer.events.CRASH, (event) => {
        console.error('💥 Kafka consumer crashed:', event.payload.error);
    });

    consumer.on(consumer.events.REQUEST_TIMEOUT, (event) => {
        console.warn('⏱️ Kafka request timeout:', event.payload);
    });

    const topic = process.env.KAFKA_TOPIC!;

    // Always read from the beginning (offset 0) regardless of committed offsets
    // First, try to reset offsets to the beginning
    try {
        const admin = kafka.admin();
        await admin.connect();

        // Get topic metadata to find partitions
        const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
        const topicMetadata = metadata.topics.find(t => t.name === topic);

        if (topicMetadata && topicMetadata.partitions.length > 0) {
            const partitions = topicMetadata.partitions.map(p => ({
                partition: p.partitionId,
                offset: '0' // Reset to offset 0
            }));

            console.log(`🔄 Resetting consumer group offsets to beginning (offset 0)...`);
            await admin.setOffsets({
                groupId: process.env.KAFKA_CONSUMER_GROUP!,
                topic,
                partitions,
            });
            console.log(`✅ Consumer group offsets reset to offset 0`);
        }

        await admin.disconnect();
    } catch (offsetError) {
        console.warn('⚠️ Could not reset offsets (this is okay if consumer group is new):', offsetError);
        // Continue anyway - fromBeginning: true will handle it
    }

    // Subscribe with fromBeginning: true to ensure we read from the beginning
    await consumer.subscribe({
        topic,
        fromBeginning: true, // Always read from beginning
    });

    console.log(`📡 Subscribed to topic: ${topic}`);
    console.log(`📖 Reading from: beginning (offset 0) - all messages will be processed`);
    console.log(`👥 Consumer Group: ${process.env.KAFKA_CONSUMER_GROUP}`);

    console.log('');
    console.log('ℹ️  Reading from offset 0 (beginning) - all messages in the topic will be processed');
    console.log('ℹ️  This includes both old and new messages');
    console.log('');

    console.log('⏳ Waiting for messages... (Press Ctrl+C to stop)');
    console.log('');
    console.log('ℹ️  Note: Messages will be read continuously. New messages will be processed as they arrive.');
    console.log('ℹ️  Offsets are auto-committed after each message is successfully processed.');
    console.log('');

    // Log that we're actively listening
    console.log('✅ Kafka consumer is now running and listening for new messages...');

    // Keep the process alive and log periodically
    const heartbeatInterval = setInterval(() => {
        console.log('💓 Kafka ingestor heartbeat - still listening for messages...');
    }, 60000); // Log every minute

    // Start consuming messages - this runs indefinitely
    // KafkaJS auto-commits offsets after each message is successfully processed
    console.log('🔄 Starting consumer.run() - this will block and wait for messages...');

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const offset = message.offset;
            const timestamp = new Date().toISOString();

            try {
                console.log(`📨 [${timestamp}] Received message from topic=${topic}, partition=${partition}, offset=${offset}`);

                const messageValue = message.value?.toString();
                if (!messageValue) {
                    console.warn('⚠️ Received empty message, skipping');
                    // Offset will still be committed even if we skip
                    return;
                }

                // Parse JSON event
                let event: KafkaEvent;
                try {
                    event = JSON.parse(messageValue);
                } catch (parseError) {
                    console.error('❌ Failed to parse message as JSON:', messageValue);
                    // Offset will still be committed even if parsing fails
                    // This prevents infinite loops on bad messages
                    return;
                }

                // Validate event structure
                if (!event.event_type) {
                    console.warn('⚠️ Event missing event_type, skipping:', event);
                    // Offset will still be committed
                    return;
                }

                console.log(`🔄 Processing event: ${event.event_type} (offset: ${offset})`);

                // Process the event
                // Wrap in try-catch to ensure we always continue processing
                try {
                    await processEvent(event);
                    console.log(`✅ Successfully processed message at offset ${offset}`);
                    // Offset is auto-committed here by KafkaJS after successful processing
                } catch (processError) {
                    // Error in processEvent - log it but continue processing other messages
                    console.error(`❌ Error in processEvent for offset ${offset}:`, processError);
                    console.error('Error details:', processError instanceof Error ? {
                        message: processError.message,
                        stack: processError.stack,
                        name: processError.name
                    } : processError);

                    // Don't throw - we want to continue processing other messages
                    // The offset will still be committed to prevent infinite retries
                    console.log(`⚠️ Continuing to process other messages despite error at offset ${offset}`);
                }

            } catch (error) {
                // This catches errors in message parsing/validation
                console.error(`❌ Error handling message at offset ${offset}:`, error);
                console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
                console.error('Error details:', error instanceof Error ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                } : error);

                // IMPORTANT: If we throw here, the offset won't be committed
                // This means the message will be retried on the next consumer run
                // For now, we'll log but not throw, so the offset gets committed
                // This prevents infinite retries on permanently bad messages
                // If you want retries, you can throw the error instead
                // throw error; // Uncomment to retry failed messages

                console.log(`⚠️ Continuing to process other messages despite error at offset ${offset}`);
            }
        },
    });

}

/**
 * Gracefully shutdown the consumer
 */
export async function shutdownKafkaIngestor(): Promise<void> {
    try {
        await consumer.disconnect();
        console.log('✅ Kafka consumer disconnected');
    } catch (error) {
        console.error('Error disconnecting Kafka consumer:', error);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Kafka ingestor...');
    await shutdownKafkaIngestor();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down Kafka ingestor...');
    await shutdownKafkaIngestor();
    process.exit(0);
});
