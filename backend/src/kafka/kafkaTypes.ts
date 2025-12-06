// ============================================================================
// Type Definitions
// ============================================================================

export interface ChatHandle {
    display_name?: string;
    identifier: string; // Phone number in E.164 format
    is_me: boolean;
}

export interface MessageReceivedData {
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

export interface KafkaEvent {
    api_version?: string;
    created_at?: string;
    data: MessageReceivedData | any;
    event_id?: string;
    event_type: string; // "message.received", "typing_indicator.received", etc.
}