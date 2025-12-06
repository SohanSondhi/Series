import { KafkaEvent, MessageReceivedData } from './kafkaTypes.js';
import { sendMessage } from './producer.js';

// ============================================================================
// Types
// ============================================================================

export interface WrappedConnection {
    firstName: string;
    fullName: string;
    phoneNumber: string;
}

interface StoredWrappedData {
    connections: WrappedConnection[];
    timestamp: number;
}

// ============================================================================
// State Management
// ============================================================================

// Map to track users who recently received wrapped messages and their connections
// Key: userPhone, Value: { connections, timestamp }
const recentWrappedRecipients = new Map<string, StoredWrappedData>();

// TTL for stored connections (10 minutes)
const WRAPPED_CONNECTIONS_TTL_MS = 10 * 60 * 1000;

/**
 * Store wrapped connections for a user after sending their wrapped message
 */
export function storeWrappedConnections(userPhone: string, connections: WrappedConnection[]): void {
    recentWrappedRecipients.set(userPhone, {
        connections,
        timestamp: Date.now(),
    });
    console.log(`📦 Stored ${connections.length} wrapped connections for ${userPhone}`);
}

/**
 * Get stored wrapped connections for a user (returns null if expired or not found)
 */
export function getStoredConnections(userPhone: string): WrappedConnection[] | null {
    const stored = recentWrappedRecipients.get(userPhone);
    
    if (!stored) {
        return null;
    }
    
    // Check if expired
    if (Date.now() - stored.timestamp > WRAPPED_CONNECTIONS_TTL_MS) {
        recentWrappedRecipients.delete(userPhone);
        console.log(`⏰ Wrapped connections expired for ${userPhone}`);
        return null;
    }
    
    return stored.connections;
}

/**
 * Clear stored connections for a user (call after GC is created or user declines)
 */
export function clearStoredConnections(userPhone: string): void {
    recentWrappedRecipients.delete(userPhone);
    console.log(`🗑️ Cleared wrapped connections for ${userPhone}`);
}

// ============================================================================
// Group Chat Creation
// ============================================================================

export interface CreateGcResult {
    success: boolean;
    matchedNames: string[];
    createdChat: boolean;
    message?: string;
}

/**
 * Parse user message to extract names they want to include in group chat
 * Handles formats like: "sarah", "sarah, alex", "sarah and alex", "sarah alex"
 */
function parseNamesFromMessage(message: string): string[] {
    const normalizedMessage = message.toLowerCase().trim();
    
    // Check for "all" or "everyone" keywords
    if (normalizedMessage === 'all' || normalizedMessage === 'everyone' || normalizedMessage === 'all of them') {
        return ['__ALL__'];
    }
    
    // Split by comma, "and", or whitespace
    const names = normalizedMessage
        .replace(/\band\b/g, ',')  // Replace "and" with comma
        .split(/[,\s]+/)           // Split by comma or whitespace
        .map(name => name.trim())
        .filter(name => name.length > 0 && name !== 'and');
    
    return names;
}

/**
 * Match parsed names against available wrapped connections
 */
function matchNamesToConnections(
    parsedNames: string[],
    wrappedConnections: WrappedConnection[]
): WrappedConnection[] {
    // Handle "all" keyword
    if (parsedNames.length === 1 && parsedNames[0] === '__ALL__') {
        return wrappedConnections;
    }
    
    const matched: WrappedConnection[] = [];
    
    for (const name of parsedNames) {
        const connection = wrappedConnections.find(
            conn => conn.firstName.toLowerCase() === name.toLowerCase()
        );
        if (connection && !matched.includes(connection)) {
            matched.push(connection);
        }
    }
    
    return matched;
}

/**
 * Create a wrapped group chat with matched connections
 * 
 * @param wrappedConnections - Up to 3 connections from the user's wrapped message
 * @param userMessage - The user's reply containing names they want in the GC
 * @param requesterPhone - The phone number of the user requesting the GC
 * @returns Result object with success status and details
 */
export async function createWrappedGroupChat(
    wrappedConnections: WrappedConnection[],
    userMessage: string,
    requesterPhone: string
): Promise<CreateGcResult> {
    console.log(`🔍 Attempting to create wrapped GC for ${requesterPhone}`);
    console.log(`   Message: "${userMessage}"`);
    console.log(`   Available connections: ${wrappedConnections.map(c => c.firstName).join(', ')}`);
    
    // Parse names from user message
    const parsedNames = parseNamesFromMessage(userMessage);
    console.log(`   Parsed names: ${parsedNames.join(', ')}`);
    
    // Match names to connections
    const matchedConnections = matchNamesToConnections(parsedNames, wrappedConnections);
    console.log(`   Matched connections: ${matchedConnections.map(c => c.firstName).join(', ') || 'none'}`);
    
    // If no matches found, return failure with helpful message
    if (matchedConnections.length === 0) {
        const availableNames = wrappedConnections.map(c => c.firstName).join(', ');
        const message = `I didn't recognize those names. Try: ${availableNames}`;
        
        // Send helpful reply to user
        await sendMessage([requesterPhone], message);
        
        return {
            success: false,
            matchedNames: [],
            createdChat: false,
            message,
        };
    }
    
    // Build group chat participants (matched connections + requester is added by API)
    const participantPhones = matchedConnections.map(c => c.phoneNumber);
    
    // Add requester to the group
    participantPhones.push(requesterPhone);
    
    // Generate display name from first names
    const matchedFirstNames = matchedConnections.map(c => c.firstName);
    const displayName = `Wrapped Reunion: ${matchedFirstNames.join(', ')}`;
    
    // Create initial message
    const initialMessage = `Hey! 👋 This group was created from a Weekly Wrapped reconnection. Time to catch up! 🎉`;
    
    try {
        // Create the group chat via sendMessage with displayName
        await sendMessage(participantPhones, initialMessage, undefined, displayName);
        
        console.log(`✅ Created wrapped group chat: ${displayName}`);
        console.log(`   Participants: ${participantPhones.join(', ')}`);
        
        // Clear stored connections since GC was created
        clearStoredConnections(requesterPhone);
        
        // Send confirmation to the requester
        await sendMessage(
            [requesterPhone],
            `Group chat "${displayName}" created! Check your messages 🎊`
        );
        
        return {
            success: true,
            matchedNames: matchedFirstNames,
            createdChat: true,
        };
    } catch (error) {
        console.error('❌ Failed to create wrapped group chat:', error);
        
        await sendMessage(
            [requesterPhone],
            `Sorry, I couldn't create the group chat right now. Please try again later.`
        );
        
        return {
            success: false,
            matchedNames: matchedFirstNames,
            createdChat: false,
            message: 'Failed to create group chat',
        };
    }
}

/**
 * Check if a message might be a group chat request (contains potential names)
 * This is a quick check before doing full matching
 */
export function mightBeGroupChatRequest(userPhone: string, messageText: string): boolean {
    // First check if user has stored connections
    const storedConnections = getStoredConnections(userPhone);
    if (!storedConnections || storedConnections.length === 0) {
        return false;
    }
    
    const normalizedText = messageText.toLowerCase().trim();
    
    // Check for "all" or "everyone"
    if (normalizedText === 'all' || normalizedText === 'everyone' || normalizedText === 'all of them') {
        return true;
    }
    
    // Check for "no" or decline keywords - clear stored connections
    if (normalizedText === 'no' || normalizedText === 'nope' || normalizedText === 'no thanks' || normalizedText === 'nah') {
        clearStoredConnections(userPhone);
        return false;
    }
    
    // Check if any stored connection's first name appears in the message
    const hasMatchingName = storedConnections.some(conn =>
        normalizedText.includes(conn.firstName.toLowerCase())
    );
    
    return hasMatchingName;
}

/**
 * Handle a potential group chat request from ingestor
 * Returns true if it was handled (either GC created or error sent), false if not a GC request
 */
export async function handleGroupChatRequest(event: KafkaEvent): Promise<boolean> {
    const data = event.data as MessageReceivedData;
    const userPhone = data.from_phone;
    const messageText = data.text;
    
    // Check if this might be a GC request
    if (!mightBeGroupChatRequest(userPhone, messageText)) {
        return false;
    }
    
    // Get stored connections
    const storedConnections = getStoredConnections(userPhone);
    if (!storedConnections) {
        return false;
    }
    
    // Attempt to create the group chat
    const result = await createWrappedGroupChat(storedConnections, messageText, userPhone);
    
    // Return true if we handled this (sent some response), even if GC wasn't created
    return true;
}
