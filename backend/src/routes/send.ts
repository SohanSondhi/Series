import { Router } from 'express';
import { sendMessage } from '../kafka/producer.js';

const router = Router();

/**
 * POST /api/send
 * Send a message via both Series API and Kafka
 * Body:
 *   - recipientPhones: string[] OR recipientPhone: string (E.164 format, e.g., "+1234567890")
 *   - text: string (message content)
 *   - fromPhone: string (optional, defaults to SENDER_NUMBER)
 *   - displayName: string (optional, for group chats)
 */
router.post('/', async (req, res) => {
    try {
        const { recipientPhone, recipientPhones, text, fromPhone, displayName } = req.body;

        // Support both recipientPhone (single) and recipientPhones (array)
        let recipientPhonesArray: string[] = [];
        if (recipientPhones) {
            recipientPhonesArray = Array.isArray(recipientPhones) ? recipientPhones : [recipientPhones];
        } else if (recipientPhone) {
            recipientPhonesArray = [recipientPhone];
        }

        // Validation
        if (recipientPhonesArray.length === 0) {
            return res.status(400).json({
                error: 'recipientPhone or recipientPhones is required',
                example: {
                    recipientPhone: '+1234567890',
                    // OR
                    recipientPhones: ['+1234567890', '+0987654321']
                }
            });
        }

        if (!text || text.trim().length === 0) {
            return res.status(400).json({
                error: 'text is required and cannot be empty'
            });
        }

        // Ensure all phone numbers are in E.164 format (starts with +)
        const normalizedRecipients = recipientPhonesArray.map(phone =>
            phone.startsWith('+') ? phone : `+${phone}`
        );

        console.log(`📤 Sending message to ${normalizedRecipients.join(', ')}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

        // Send via both Series API and Kafka
        const results = await sendMessage(normalizedRecipients, text.trim(), fromPhone, displayName);

        // Check if both succeeded
        if (results.errors.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Message sent successfully via both Series API and Kafka',
                results,
            });
        }

        // Partial success (one succeeded, one failed)
        if (results.seriesAPI || results.kafka) {
            return res.status(207).json({
                success: 'partial',
                message: 'Message sent with some errors',
                results,
                errors: results.errors,
            });
        }

        // Both failed
        return res.status(500).json({
            success: false,
            message: 'Failed to send message via both Series API and Kafka',
            errors: results.errors,
        });

    } catch (error) {
        console.error('❌ Error in send route:', error);
        res.status(500).json({
            error: 'Failed to send message',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
