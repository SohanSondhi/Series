/**
 * Utility functions for Kafka message processing
 */

/**
 * Normalize phone number to digits only (consistent with database storage)
 * Removes all non-digit characters including + prefix
 * 
 * @param phone - Phone number in any format (E.164, with dashes, etc.)
 * @returns Normalized phone number (digits only)
 * 
 * @example
 * normalizePhoneNumber('+1-234-567-8900') // Returns '12345678900'
 * normalizePhoneNumber('(234) 567-8900')   // Returns '2345678900'
 */
export function normalizePhoneNumber(phone: string): string {
    return phone.replace(/\D/g, '');
}

/**
 * Parse timestamp from various formats
 * Tries to parse from sent_at first, then created_at, then falls back to current time
 * 
 * @param sentAt - Timestamp string from message (format: "2025-12-05 14:42:05 -0600")
 * @param createdAt - Timestamp string from event (ISO format)
 * @returns Parsed Date object
 */
export function parseTimestamp(sentAt?: string, createdAt?: string): Date {
    if (sentAt) {
        const parsed = new Date(sentAt);
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    if (createdAt) {
        const parsed = new Date(createdAt);
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return new Date();
}
