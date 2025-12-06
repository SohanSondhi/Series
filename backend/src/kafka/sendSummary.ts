import { KafkaEvent, MessageReceivedData } from './kafkaTypes.js';
import { sendMessage } from './producer.js';

/**
 * Improved detection for summary/wrapped requests
 * Checks for various keywords and phrases that indicate the user wants their wrapped/summary
 */
export async function determineIfSummaryRelated(event: KafkaEvent): Promise<boolean> {
    const data = event.data as MessageReceivedData;

    // Don't send a summary to the admin number
    if (data.from_phone === process.env.SENDER_NUMBER) {
        return false;
    }

    // Normalize text for case-insensitive matching
    const normalizedText = data.text.toLowerCase().trim();

    // Keywords that indicate a request for summary/wrapped
    const summaryKeywords = [
        'summary',
        'wrapped',
        'recap',
        'week summary',
        'my summary',
        'send summary',
        'show summary',
        'get summary',
        'give me summary',
        'can i get',
        'can you send',
        'send me',
        'show me',
        'my wrapped',
        'send wrapped',
        'show wrapped',
        'get wrapped',
        'give me wrapped',
        'week recap',
        'my recap',
        'send recap',
        'show recap',
        'get recap',
    ];

    // Check for exact keyword matches
    const hasKeyword = summaryKeywords.some(keyword => normalizedText.includes(keyword));

    // Check for question patterns asking for summary
    const questionPatterns = [
        /(can|could|would|will)\s+(you\s+)?(send|show|give|get)\s+(me\s+)?(a\s+)?(summary|wrapped|recap)/i,
        /(i\s+)?(want|need|would like)\s+(to\s+)?(see|get|have|view)\s+(my\s+)?(summary|wrapped|recap)/i,
        /(what|where)\s+(is|are)\s+(my\s+)?(summary|wrapped|recap)/i,
        /(show|send|give)\s+(me\s+)?(my\s+)?(summary|wrapped|recap)/i,
    ];

    const hasQuestionPattern = questionPatterns.some(pattern => pattern.test(data.text));

    // Check for imperative requests
    const imperativePatterns = [
        /^(send|show|give|get)\s+(me\s+)?(my\s+)?(summary|wrapped|recap)/i,
        /(summary|wrapped|recap)\s+(please|pls|now)/i,
    ];

    const hasImperativePattern = imperativePatterns.some(pattern => pattern.test(data.text));

    // Must have at least one indicator
    return hasKeyword || hasQuestionPattern || hasImperativePattern;
}

/**
 * Send a dynamic, conversational summary message based on the user's request
 */
export async function sendSummaryTextMessage(event: KafkaEvent): Promise<void> {
    const data = event.data as MessageReceivedData;
    const message = formatSummaryMessage(event);
    await sendMessage([data.from_phone], message);
}

/**
 * Format a dynamic summary message based on the user's request style
 */
function formatSummaryMessage(event: KafkaEvent): string {
    const data = event.data as MessageReceivedData;
    const normalizedText = data.text.toLowerCase().trim();

    // Normalize phone number for the URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const wrappedUrl = `${frontendUrl}/wrapped/${data.from_phone}`;

    // Determine the tone and style of response based on the user's message
    let responseMessage: string;

    // Check if user used casual/informal language
    const isCasual = /(hey|hi|yo|sup|what's up|wassup)/i.test(data.text) ||
        normalizedText.length < 20;

    // Check if user used formal language
    const isFormal = /(please|kindly|would you|could you|may i)/i.test(data.text);

    // Check if user seems excited
    const isExcited = /(!{2,}|woo|yay|awesome|cool|nice)/i.test(data.text);

    // Generate dynamic response based on context
    if (isCasual) {
        const casualResponses = [
            `Hey! Here's your wrapped: ${wrappedUrl}`,
            `Got it! Check out your week's summary here: ${wrappedUrl}`,
            `Here you go! Your wrapped is ready: ${wrappedUrl}`,
            `Sure thing! View your summary: ${wrappedUrl}`,
        ];
        responseMessage = casualResponses[Math.floor(Math.random() * casualResponses.length)];
    } else if (isFormal) {
        const formalResponses = [
            `Of course! Here's your weekly summary: ${wrappedUrl}`,
            `Certainly! You can view your wrapped here: ${wrappedUrl}`,
            `I'd be happy to share your summary: ${wrappedUrl}`,
        ];
        responseMessage = formalResponses[Math.floor(Math.random() * formalResponses.length)];
    } else if (isExcited) {
        const excitedResponses = [
            `Awesome! Here's your wrapped: ${wrappedUrl}`,
            `Exciting! Check out your week's summary: ${wrappedUrl}`,
            `Love the energy! Your wrapped is ready: ${wrappedUrl}`,
        ];
        responseMessage = excitedResponses[Math.floor(Math.random() * excitedResponses.length)];
    } else {
        // Default friendly responses
        const defaultResponses = [
            `Great! Here's your weekly summary: ${wrappedUrl}`,
            `Perfect! Your wrapped is ready: ${wrappedUrl}`,
            `Here's your week's recap: ${wrappedUrl}`,
            `Your summary is ready! View it here: ${wrappedUrl}`,
            `Check out your wrapped: ${wrappedUrl}`,
        ];
        responseMessage = defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
    }

    return responseMessage;
}