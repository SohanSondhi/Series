import { Kafka } from 'kafkajs';
import dotenv from 'dotenv';
import { db } from '../db/index.js';
import { users, messages, connections } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

dotenv.config();

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
});

// Kafka event structure based on Series iMessage Service API
interface ChatHandle {
    display_name?: string;
    identifier: string; // Phone number in E.164 format
    is_me: boolean;
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
 * Insert a message into the database
 */
async function insertMessage(
    userId: number,
    messageText: string,
    direction: 'inbound' | 'outbound',
    timestamp: Date,
    counterpartyPhone?: string
): Promise<void> {
    await db.insert(messages).values({
        userId,
        messageText,
        direction,
        timestamp,
        counterpartyPhone: counterpartyPhone || null,
    });
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
 * Process a message.received event
 */
async function processMessageReceived(event: KafkaEvent): Promise<void> {
    const data = event.data as MessageReceivedData;

    if (!data.from_phone || !data.text) {
        console.warn('Message missing required fields, skipping:', event);
        return;
    }

    // Find the "me" phone number from chat_handles
    const meHandle = data.chat_handles?.find(h => h.is_me);
    const myPhone = meHandle ? normalizePhoneNumber(meHandle.identifier) : null;

    // Determine direction: if from_phone matches "me", it's outbound; otherwise inbound
    const fromPhone = normalizePhoneNumber(data.from_phone);
    const direction: 'inbound' | 'outbound' = myPhone && fromPhone === myPhone ? 'outbound' : 'inbound';

    // Find counterparty (the other participant(s) in the chat)
    const counterpartyHandles = data.chat_handles?.filter(h => !h.is_me) || [];
    // For now, use the first counterparty (for group chats, we might want to handle differently)
    const counterpartyPhone = counterpartyHandles.length > 0
        ? normalizePhoneNumber(counterpartyHandles[0].identifier)
        : null;

    // Determine which user this message belongs to
    // For inbound: the user is the sender (from_phone)
    // For outbound: the user is "me" (the one sending)
    const userPhone = direction === 'inbound' ? fromPhone : (myPhone || fromPhone);

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

    // Insert message
    await insertMessage(
        userId,
        data.text,
        direction,
        messageTimestamp,
        counterpartyPhone || undefined
    );

    // Update connections if we have counterparty info
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

    console.log(`✅ Processed ${direction} message: user=${userPhone}, counterparty=${counterpartyPhone || 'N/A'}, text="${data.text.substring(0, 50)}${data.text.length > 50 ? '...' : ''}"`);
}

/**
 * Process a Kafka event (can be message.received, typing_indicator, etc.)
 */
async function processEvent(event: KafkaEvent): Promise<void> {
    try {
        // Only process message.received events for now
        if (event.event_type === 'message.received') {
            await processMessageReceived(event);
        } else {
            // Log other event types but don't process them
            console.log(`ℹ️  Skipping event type: ${event.event_type}`);
        }
    } catch (error) {
        console.error('❌ Error processing event:', error);
        console.error('Event:', JSON.stringify(event, null, 2));
        // Don't throw - we want to continue processing other messages
    }
}

/**
 * Start consuming messages from Kafka
 */
export async function startKafkaIngestor(): Promise<void> {
    try {
        // Log configuration (without sensitive data)
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

        const topic = process.env.KAFKA_TOPIC!;
        await consumer.subscribe({
            topic,
            fromBeginning: process.env.KAFKA_FROM_BEGINNING === 'true',
        });

        console.log(`📡 Listening to topic: ${topic}`);
        console.log('⏳ Waiting for messages... (Press Ctrl+C to stop)');

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const messageValue = message.value?.toString();
                    if (!messageValue) {
                        console.warn('Received empty message, skipping');
                        return;
                    }

                    // Parse JSON event
                    let event: KafkaEvent;
                    try {
                        event = JSON.parse(messageValue);
                    } catch (parseError) {
                        console.error('Failed to parse message as JSON:', messageValue);
                        return;
                    }

                    // Validate event structure
                    if (!event.event_type) {
                        console.warn('Event missing event_type, skipping:', event);
                        return;
                    }

                    // Process the event
                    await processEvent(event);
                } catch (error) {
                    console.error('Error handling message:', error);
                    // Continue processing other messages
                }
            },
        });
    } catch (error) {
        console.error('❌ Kafka consumer error:', error);
        throw error;
    }
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
