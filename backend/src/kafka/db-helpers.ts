import { db } from '../db/index.js';
import { users, messages, connections } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
/**
 * Database helper functions for Kafka message processing
 */

/**
 * Upsert a user based on phone number
 * If user exists, update it; if not, create it
 * 
 * @param phoneNumber - Phone number in any format
 * @returns User ID
 */
export async function upsertUser(phoneNumber: string): Promise<number> {
    if (!phoneNumber) {
        throw new Error('Phone number is required');
    }

    // Try to find existing user
    const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.number, phoneNumber))
        .limit(1);

    if (existingUser) {
        // Update existing user's updatedAt timestamp
        await db
            .update(users)
            .set({ updatedAt: new Date() })
            .where(eq(users.id, existingUser.id));
        return existingUser.id;
    } else {
        // Create new user with minimal info
        const [newUser] = await db
            .insert(users)
            .values({
                firstName: 'Unknown',
                lastName: 'User',
                number: phoneNumber,
            })
            .returning();
        return newUser.id;
    }
}

/**
 * Insert a message into the database with multiple counterparties
 * 
 * @param userId - ID of the user who sent/received the message
 * @param messageText - Message text content
 * @param timestamp - Message timestamp
 * @param counterpartyPhones - Array of counterparty phone numbers (for group chats)
 * @param chatId - Optional chat ID from Series API
 * @returns Message ID
 */
export async function insertMessage(
    userId: number,
    messageText: string,
    timestamp: Date,
    counterpartyPhones: string[],
    chatId?: string | null
): Promise<number> {
    // Insert the message with recipients as an array
    const [insertedMessage] = await db.insert(messages).values({
        userId,
        messageText,
        timestamp,
        chatId: chatId || null,
        messageRecipients: counterpartyPhones.length > 0 ? counterpartyPhones : null,
    }).returning({ id: messages.id });

    return insertedMessage.id;
}

/**
 * Update connections between users based on message counterparty
 * Creates a bidirectional connection between two users
 * 
 * @param userId - ID of the user
 * @param counterpartyPhone - Phone number of the counterparty
 */
export async function updateConnection(userId: number, counterpartyPhone?: string): Promise<void> {
    if (!counterpartyPhone) {
        return;
    }

    try {
        const [counterpartyUser] = await db
            .select()
            .from(users)
            .where(eq(users.number, counterpartyPhone))
            .limit(1);

        if (!counterpartyUser) {
            return;
        }

        // Check if connection already exists
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
            try {
                await db.insert(connections).values({
                    userId,
                    connectedUserId: counterpartyUser.id,
                });
            } catch (error: any) {
                // Handle unique constraint violation
                if (error.code === '23505') {
                    return; // Connection already exists
                }
                throw error;
            }
        }
    } catch (error) {
        console.error('Error updating connection:', error);
    }
}
