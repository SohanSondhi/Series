import { KafkaEvent, MessageReceivedData } from './kafkaTypes.js';
import { sendMessage } from './producer.js';
export async function determineIfSummaryRelated(event: KafkaEvent): Promise<boolean> {
    const data = event.data as MessageReceivedData;
    // we dont't want to send a summary to the admin number
    if (data.from_phone === process.env.SENDER_NUMBER) {
        return false;
    }
    return data.text.includes('summary') || data.text.includes('Summary');
}

export async function sendSummaryTextMessage(event: KafkaEvent): Promise<void> {
    const data = event.data as MessageReceivedData;
    await sendMessage([data.from_phone], formatSummaryMessage(event));
}

function formatSummaryMessage(event: KafkaEvent): string {
    const data = event.data as MessageReceivedData;
    // Normalize phone number (remove non-digits) for the URL
    // Use proper URL format with protocol for clickable links in SMS/iMessage
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const wrappedUrl = `${frontendUrl}/wrapped/${data.from_phone}`;
    return `Awesome! We'll send you a summary of your week's messages. Click here to view: ${wrappedUrl}`;
}