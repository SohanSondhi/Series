import { User } from '../types/user';

/**
 * Get the display name for a user
 * - If user has first_name and last_name, return the full name
 * - If the phone number matches the sender number, return "Your AI Friend"
 * - Otherwise, return the phone number
 */
export function getUserDisplayName(user: User | null | undefined): string {
    if (!user) {
        return 'Unknown User';
    }

    // Check if this is the sender number (admin/AI friend)
    const senderNumber = import.meta.env.VITE_SENDER_NUMBER;
    if (senderNumber) {
        const normalizedSenderNumber = senderNumber.replace(/\D/g, '');
        const normalizedUserNumber = user.number.replace(/\D/g, '');
        if (normalizedUserNumber === normalizedSenderNumber) {
            return 'Your AI Friend';
        }
    }

    // Check if user has a valid name (not "Unknown User")
    const hasValidName = user.first_name &&
        user.last_name &&
        !(user.first_name === 'Unknown' && user.last_name === 'User') &&
        user.first_name.trim() !== '' &&
        user.last_name.trim() !== '';

    if (hasValidName) {
        return `${user.first_name} ${user.last_name}`;
    }

    // Fallback to phone number
    return user.number || 'Unknown';
}

/**
 * Get initials for a user (for avatar placeholders)
 */
export function getUserInitials(user: User | null | undefined): string {
    if (!user) {
        return '??';
    }

    // Check if this is the sender number
    const senderNumber = import.meta.env.VITE_SENDER_NUMBER;
    if (senderNumber) {
        const normalizedSenderNumber = senderNumber.replace(/\D/g, '');
        const normalizedUserNumber = user.number.replace(/\D/g, '');
        if (normalizedUserNumber === normalizedSenderNumber) {
            return 'AI';
        }
    }

    // Check if user has a valid name
    const hasValidName = user.first_name &&
        user.last_name &&
        !(user.first_name === 'Unknown' && user.last_name === 'User') &&
        user.first_name.trim() !== '' &&
        user.last_name.trim() !== '';

    if (hasValidName) {
        return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }

    // Fallback: use first few digits of phone number
    const cleanNumber = user.number.replace(/\D/g, '');
    if (cleanNumber.length >= 2) {
        return cleanNumber.slice(-2);
    }
    return '??';
}
