import { Kafka } from 'kafkajs';
import dotenv from 'dotenv';
import { parseTimestamp } from './utils.js';
import { upsertUser, insertMessage, updateConnection } from './db-helpers.js';
import { KafkaEvent, MessageReceivedData } from './kafkaTypes.js';
import { determineIfSummaryRelated, sendSummaryTextMessage } from './sendSummary.js';
import { handleGroupChatRequest } from './createGc.js';

dotenv.config();

// ============================================================================
// Configuration & Validation
// ============================================================================

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


// ============================================================================
// Message Processing Logic
// ============================================================================

/**
 * Process a message.received event
 */
async function processMessageReceived(event: KafkaEvent): Promise<void> {
    const data = event.data as MessageReceivedData;

    // Validate required fields
    if (!data.from_phone || !data.text) {
        console.warn('Message missing required fields, skipping:', event);
        return;
    }

    const userPhone = data.from_phone;
    console.log("Received data:", data);

    // Mark the message as read
    if (data.chat_id) {
        const apiBase = process.env.SERIES_API_BASE?.trim();
        const apiKey = process.env.SERIES_API_KEY?.trim();
        const markAsReadUrl = `${apiBase}/api/chats/${data.chat_id}/mark_as_read`;
        
        console.log(`📖 Marking message as read: ${markAsReadUrl}`);
        
        const markAsReadResponse = await fetch(markAsReadUrl, {
            method: "PUT",
            headers: {
                'Accept': '*/*',
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (markAsReadResponse.status !== 204) {
            console.error(`Failed to mark chat ${data.chat_id} as read, status: ${markAsReadResponse.status}`);
        } else {
            console.log(`✅ Marked chat ${data.chat_id} as read`);
        }
    }

    // Start typing indicator
    let typingInterval: NodeJS.Timeout | null = null;
    if (data.chat_id) {
        const apiBase = process.env.SERIES_API_BASE?.trim();
        const apiKey = process.env.SERIES_API_KEY?.trim();
        
        const startTyping = async () => {
            try {
                const response = await fetch(`${apiBase}/api/chats/${data.chat_id}/start_typing`, {
                    method: "POST",
                    headers: {
                        'Accept': '*/*',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                });
                console.log(`⌨️ Typing indicator sent, status: ${response.status}`);
            } catch (error) {
                console.error(`Failed to send typing indicator for chat ${data.chat_id}:`, error);
            }
        };

        // Trigger the typing indicator every 3 seconds
        typingInterval = setInterval(startTyping, 3000);
        await startTyping(); // Trigger the first typing indicator immediately
    }

    try {
        // First, check if this is a group chat request (user responding to wrapped GC prompt)
        const wasGcRequest = await handleGroupChatRequest(event);
        if (wasGcRequest) {
            console.log(`✅ Handled as group chat request`);
            // Don't return early - still process message for DB storage below
        } else {
            // Check if the message is related to "wrapped"
            const isSummaryRelated = await determineIfSummaryRelated(event);

            if (isSummaryRelated) {
                // Send the summary message
                await sendSummaryTextMessage(event);
            }
        }
    } catch (error) {
        console.error('Error processing message:', error);
    } finally {
        // Stop typing indicator after the message is sent
        if (data.chat_id && typingInterval) {
            clearInterval(typingInterval);
            const apiBase = process.env.SERIES_API_BASE?.trim();
            const apiKey = process.env.SERIES_API_KEY?.trim();
            try {
                const response = await fetch(`${apiBase}/api/chats/${data.chat_id}/stop_typing`, {
                    method: "POST",
                    headers: {
                        'Accept': '*/*',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                });
                console.log(`🛑 Stop typing sent, status: ${response.status}`);
            } catch (error) {
                console.error(`Failed to stop typing indicator for chat ${data.chat_id}:`, error);
            }
        }
    }

    // Find all counterparties (the other participant(s) in the chat)
    const counterpartyPhonesUnfiltered = data.chat_handles?.map(h => h.identifier) || [];
    const counterpartyPhones = counterpartyPhonesUnfiltered.filter(phone => phone !== data.from_phone);

    // Parse timestamp
    const messageTimestamp = parseTimestamp(data.sent_at, event.created_at);

    // Upsert user based on the phone number
    const userId = await upsertUser(userPhone);

    // Insert message with all counterparties
    await insertMessage(
        userId,
        data.text,
        messageTimestamp,
        counterpartyPhones,
        data.chat_id ? String(data.chat_id) : null
    );

    // Update connections for all counterparties
    for (const counterpartyPhone of counterpartyPhones) {
        if (counterpartyPhone && counterpartyPhone !== userPhone) {
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

    console.log(`✅ Processed message: from=${data.from_phone}, to=[${counterpartyPhones.join(', ') || 'N/A'}], text="${data.text.substring(0, 50)}${data.text.length > 50 ? '...' : ''}"`);
}

/**
 * Process a Kafka event (can be message.received, typing_indicator, etc.)
 */
async function processEvent(event: KafkaEvent): Promise<void> {
    // Only process message.received events for now
    if (event.event_type === 'message.received') {
        await processMessageReceived(event);
    } else {
        console.log(`ℹ️  Skipping event type: ${event.event_type}`);
    }
}



// ============================================================================
// Consumer Lifecycle
// ============================================================================

/**
 * Start consuming messages from Kafka
 */
export async function startKafkaIngestor(): Promise<void> {
    try {
        // Log configuration
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
        const fromBeginning = process.env.KAFKA_FROM_BEGINNING === 'true';

        await consumer.subscribe({
            topic,
            fromBeginning,
        });

        console.log(`📡 Listening to topic: ${topic}`);
        console.log(`📖 Reading from: ${fromBeginning ? 'beginning' : 'latest committed offset'}`);
        console.log('⏳ Waiting for messages... (Press Ctrl+C to stop)');
        console.log('');

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const offset = message.offset;
                    const timestamp = new Date().toISOString();
                    console.log(`📨 [${timestamp}] Received message from topic=${topic}, partition=${partition}, offset=${offset}`);

                    const messageValue = message.value?.toString();
                    if (!messageValue) {
                        console.warn('⚠️ Received empty message, skipping');
                        return;
                    }

                    // Parse JSON event
                    let event: KafkaEvent;
                    try {
                        event = JSON.parse(messageValue);
                    } catch (parseError) {
                        console.error('❌ Failed to parse message as JSON:', messageValue);
                        return;
                    }

                    // Validate event structure
                    if (!event.event_type) {
                        console.warn('⚠️ Event missing event_type, skipping:', event);
                        return;
                    }

                    console.log(`🔄 Processing event: ${event.event_type} (offset: ${offset})`);

                    // Process the event
                    await processEvent(event);

                    console.log(`✅ Successfully processed message at offset ${offset}`);
                } catch (error) {
                    console.error(`❌ Error handling message at offset ${message.offset}:`, error);
                    console.error('Error details:', error instanceof Error ? {
                        message: error.message,
                        stack: error.stack,
                        name: error.name
                    } : error);
                    // Continue processing other messages - don't throw
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
