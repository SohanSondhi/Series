import { Kafka } from 'kafkajs';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

// Series Hackathon Service API Configuration
const SENDER_NUMBER = process.env.SENDER_NUMBER;

// Kafka Configuration
const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'test-producer',
    brokers: process.env.KAFKA_BROKERS!.split(','),
    ssl: process.env.KAFKA_TLS_ENABLED !== 'false',
    sasl: {
        mechanism: process.env.KAFKA_SASL_MECHANISM as any || 'plain',
        username: process.env.KAFKA_SASL_USERNAME!,
        password: process.env.KAFKA_SASL_PASSWORD!,
    },
});

// Singleton producer instance (keep connection alive)
let producerInstance: ReturnType<typeof kafka.producer> | null = null;
let isProducerConnected = false;

/**
 * Get or create Kafka producer instance (singleton pattern)
 * Maintains connection to avoid reconnecting on every message
 */
async function getProducer() {
    if (!producerInstance) {
        producerInstance = kafka.producer();
    }

    if (!isProducerConnected) {
        await producerInstance.connect();
        isProducerConnected = true;
        console.log('✅ Kafka producer connected');
    }

    return producerInstance;
}

/**
 * Disconnect Kafka producer (call on shutdown)
 */
export async function disconnectProducer() {
    if (producerInstance && isProducerConnected) {
        await producerInstance.disconnect();
        isProducerConnected = false;
        console.log('✅ Kafka producer disconnected');
    }
}

/**
 * Find or get chat ID by phone numbers
 * @param phoneNumbers - Array of phone numbers (E.164 format) to search for
 * @returns Chat ID if found, null otherwise
 */
export async function findChatByPhoneNumbers(phoneNumbers: string[]): Promise<number | null> {
    const API_BASE = process.env.SERIES_API_BASE;
    const API_KEY = process.env.SERIES_API_KEY;

    if (!API_BASE || !API_KEY) {
        console.warn('⚠️ Series API not configured, cannot find chat');
        return null;
    }

    try {
        // Try to find chat by first phone number
        // The API filters chats by a participant phone number
        const searchPhone = phoneNumbers[0];
        const response = await fetch(
            `${API_BASE}/api/chats?phone_number=${encodeURIComponent(searchPhone)}&per_page=100`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'accept': 'application/json',
                },
            }
        );

        if (!response.ok) {
            console.warn(`⚠️ Failed to search for chat: ${response.status}`);
            return null;
        }

        const responseData = await response.json() as { data?: any[] };
        const chats = responseData.data || [];

        // Find a chat that matches all phone numbers
        for (const chat of chats) {
            const chatPhones = (chat.chat_handles || []).map((h: any) => h.phone_number);
            const normalizedChatPhones = chatPhones.map((p: string) => p.replace(/\D/g, ''));
            const normalizedSearchPhones = phoneNumbers.map(p => p.replace(/\D/g, ''));

            // Check if all search phones are in the chat
            const allPhonesMatch = normalizedSearchPhones.every(searchPhone =>
                normalizedChatPhones.includes(searchPhone)
            );

            // Also check if sender number is in the chat
            if (SENDER_NUMBER) {
                const senderNormalized = SENDER_NUMBER.replace(/\D/g, '');
                if (allPhonesMatch && normalizedChatPhones.includes(senderNormalized)) {
                    console.log(`✅ Found existing chat ID: ${chat.id}`);
                    return chat.id;
                }
            } else if (allPhonesMatch) {
                console.log(`✅ Found existing chat ID: ${chat.id}`);
                return chat.id;
            }
        }

        console.log('ℹ️ No existing chat found, will create new chat');
        return null;
    } catch (error) {
        console.error('❌ Error finding chat:', error);
        return null;
    }
}

/**
 * Send a message to Kafka cluster
 * @param fromPhone - Phone number sending the message
 * @param recipientPhones - Array of recipient phone numbers
 * @param text - Message text content
 * @param chatId - Optional chat ID
 */
export async function sendKafkaMessage(
    fromPhone: string,
    recipientPhones: string[],
    text: string,
    chatId?: number | null
) {
    try {
        const producer = await getProducer();

        // Build chat_handles array
        const chatHandles = [
            {
                identifier: fromPhone,
                is_me: true,
                display_name: 'You'
            },
            ...recipientPhones.map(phone => ({
                identifier: phone,
                is_me: false,
                display_name: phone
            }))
        ];

        await producer.send({
            topic: process.env.KAFKA_TOPIC!,
            messages: [
                {
                    value: JSON.stringify({
                        api_version: 'v2',
                        created_at: new Date().toISOString(),
                        event_type: 'message.received',
                        data: {
                            from_phone: fromPhone,
                            text: text,
                            chat_handles: chatHandles,
                            chat_id: chatId ? String(chatId) : undefined,
                            sent_at: new Date().toISOString(),
                            service: 'iMessage',
                        },
                    }),
                },
            ],
        });

        console.log(`✅ Kafka message sent: from ${fromPhone} to ${recipientPhones.join(', ')}`);
    } catch (error) {
        console.error('❌ Error sending Kafka message:', error);
        throw error;
    }
}

/**
 * Send a message via Series Hackathon Service API (actually sends SMS/iMessage)
 * @param recipientPhones - Array of recipient phone numbers (E.164 format)
 * @param text - Message text content
 * @param chatId - Optional existing chat ID (if found via findChatByPhoneNumbers)
 * @param displayName - Optional display name for group chats
 * @returns Response data from the API
 */
export async function sendSeriesAPIMessage(
    recipientPhones: string[],
    text: string,
    chatId?: number | null,
    displayName?: string | null
) {
    const API_BASE = process.env.SERIES_API_BASE;
    const API_KEY = process.env.SERIES_API_KEY;

    if (!API_BASE || !API_KEY || !SENDER_NUMBER) {
        throw new Error('Series API configuration missing (SERIES_API_BASE, SERIES_API_KEY, SENDER_NUMBER)');
    }

    try {
        let response;

        if (chatId) {
            // Use existing chat ID to send message
            response = await fetch(`${API_BASE}/api/chats/${chatId}/chat_messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`,
                    'accept': 'application/json',
                },
                body: JSON.stringify({
                    message: {
                        text: text,
                    },
                }),
            });
        } else {
            // Create new chat and send initial message
            response = await fetch(`${API_BASE}/api/chats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`,
                    'accept': 'application/json',
                },
                body: JSON.stringify({
                    chat: {
                        phone_numbers: recipientPhones,
                        display_name: displayName || null,
                    },
                    message: {
                        text: text,
                    },
                    send_from: SENDER_NUMBER,
                }),
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Series API failed: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log(`✅ Series API message sent: to ${recipientPhones.join(', ')}${chatId ? ` (chat ID: ${chatId})` : ''}`);
        return data;
    } catch (error) {
        console.error('❌ Error sending Series API message:', error);
        throw error;
    }
}

/**
 * Send a message via both Series API and Kafka
 * This is the main function to use when sending messages
 * @param recipientPhones - Array of recipient phone numbers (E.164 format) or single phone number string
 * @param text - Message text content
 * @param fromPhone - Optional sender phone number (defaults to SENDER_NUMBER)
 * @param displayName - Optional display name for group chats
 * @returns Object with results from both API calls
 */
export async function sendMessage(
    recipientPhones: string | string[],
    text: string,
    fromPhone?: string,
    displayName?: string | null
) {
    if (!SENDER_NUMBER) {
        throw new Error('SENDER_NUMBER environment variable is not set');
    }
    const senderPhone = fromPhone || SENDER_NUMBER;

    // Normalize recipientPhones to array
    const recipientPhonesArray = Array.isArray(recipientPhones) ? recipientPhones : [recipientPhones];

    // Ensure all phone numbers are in E.164 format
    const normalizedRecipients = recipientPhonesArray.map(phone =>
        phone.startsWith('+') ? phone : `+${phone}`
    );

    const results = {
        seriesAPI: null as any,
        kafka: null as any,
        chatId: null as number | null,
        errors: [] as string[],
    };

    // Try to find existing chat first
    let chatId: number | null = null;
    try {
        chatId = await findChatByPhoneNumbers([senderPhone, ...normalizedRecipients]);
        results.chatId = chatId;
    } catch (error) {
        console.warn('⚠️ Error finding chat, will create new one:', error);
    }

    // Send via Series API (actually sends the message)
    try {
        results.seriesAPI = await sendSeriesAPIMessage(
            normalizedRecipients,
            text,
            chatId,
            displayName
        );
        // Extract chat ID from response if we created a new chat
        if (!chatId && results.seriesAPI?.id) {
            chatId = results.seriesAPI.id;
            results.chatId = chatId;
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Series API: ${errorMsg}`);
        console.error('⚠️ Series API failed, continuing with Kafka...');
    }

    await sendKafkaMessage(senderPhone, normalizedRecipients, text, chatId);
    results.kafka = { success: true };

    return results;
}