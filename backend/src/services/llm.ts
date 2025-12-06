/**
 * LLM Service for generating content from text
 * Uses Llama (via Ollama) as the default LLM
 */

interface LLMConfig {
    provider?: 'llama' | 'ollama' | 'openai' | 'anthropic';
    apiKey?: string;
    model?: string;
    baseUrl?: string;
}

interface GenerateRecapOptions {
    textContent: string;
    context?: string;
    maxWords?: number;
}

/**
 * Generate a weekly recap from aggregated text content using LLM
 * 
 * @param options - Options for recap generation
 * @returns Generated recap text
 */
export async function generateWeeklyRecap(options: GenerateRecapOptions): Promise<string> {
    const {
        textContent,
        context = 'The user is a user on a social media networking platform.',
        maxWords = 200,
    } = options;

    if (!textContent || textContent.trim().length === 0) {
        throw new Error('Text content is required to generate recap');
    }

    // Get LLM configuration from environment
    const llmProvider = (process.env.LLM_PROVIDER || 'llama').toLowerCase();
    // Default to host.docker.internal for accessing Ollama on host machine from Docker container
    // On Mac/Windows Docker Desktop, this allows containers to access host services
    // On Linux, you may need to use the host's IP address or run with --network host
    const baseUrl = process.env.LLM_BASE_URL || process.env.OLLAMA_BASE_URL || 'http://host.docker.internal:11434';
    const model = process.env.LLM_MODEL || process.env.OLLAMA_MODEL || 'llama3.2';

    console.log(`🤖 LLM Configuration: provider=${llmProvider}, baseUrl=${baseUrl}, model=${model}`);

    // Default to Llama (Ollama)
    // Ollama is a local LLM server that runs Llama models
    // No API key required for local use
    if (llmProvider === 'llama' || llmProvider === 'ollama' || !process.env.LLM_PROVIDER) {
        return generateRecapWithLlama({
            textContent,
            context,
            maxWords,
            baseUrl,
            model,
        });
    }

    // Support OpenAI as fallback
    if (llmProvider === 'openai') {
        const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
        if (!apiKey) {
            throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY in environment variables.');
        }
        return generateRecapWithOpenAI({
            textContent,
            context,
            maxWords,
            apiKey,
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        });
    }

    throw new Error(`LLM provider "${llmProvider}" is not yet supported. Please use 'llama' or 'openai'.`);
}

/**
 * Generate recap using Llama (via Ollama)
 */
async function generateRecapWithLlama(options: {
    textContent: string;
    context: string;
    maxWords: number;
    baseUrl: string;
    model: string;
}): Promise<string> {
    const { textContent, context, maxWords, baseUrl, model } = options;

    const prompt = `You are an AI assistant helping to create engaging weekly recaps for social media users.

Context: ${context}

Task: Analyze the following aggregated text content from a user's social media posts (specifically Twitter/X posts) and create a concise, engaging weekly recap that highlights:
- The user's most relevant big events or thoughts
- Key themes or topics they discussed
- Notable moments or insights

Requirements:
- Format the recap nicely with clear sections or bullet points
- Keep it engaging and personal
- Maximum ${maxWords} words
- Focus on the most important and interesting content
- Write in a friendly, conversational tone

User's aggregated posts content:
${textContent}

Please generate the weekly recap now:`;

    try {
        const apiUrl = `${baseUrl}/api/generate`;
        console.log(`📡 Calling Llama API at: ${apiUrl}`);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    num_predict: Math.ceil(maxWords * 1.5), // Approximate token limit
                },
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.error ||
                `Llama API error: ${response.status} ${response.statusText}`
            );
        }

        const data = await response.json();
        const recap = data.response;

        if (!recap) {
            throw new Error('No recap generated from Llama API');
        }

        return recap.trim();
    } catch (error) {
        console.error('Error generating recap with Llama:', error);
        throw error;
    }
}

/**
 * Generate recap using OpenAI GPT
 */
async function generateRecapWithOpenAI(options: {
    textContent: string;
    context: string;
    maxWords: number;
    apiKey: string;
    model: string;
}): Promise<string> {
    const { textContent, context, maxWords, apiKey, model } = options;

    const prompt = `You are an AI assistant helping to create engaging weekly recaps for social media users.

Context: ${context}

Task: Analyze the following aggregated text content from a user's social media posts (specifically Twitter/X posts) and create a concise, engaging weekly recap that highlights:
- The user's most relevant big events or thoughts
- Key themes or topics they discussed
- Notable moments or insights

Requirements:
- Format the recap nicely with clear sections or bullet points
- Keep it engaging and personal
- Maximum ${maxWords} words
- Focus on the most important and interesting content
- Write in a friendly, conversational tone

User's aggregated posts content:
${textContent}

Please generate the weekly recap now:`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that creates engaging social media recaps.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.7,
                max_tokens: Math.ceil(maxWords * 1.5), // Allow some buffer for tokens
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.error?.message ||
                `OpenAI API error: ${response.status} ${response.statusText}`
            );
        }

        const data = await response.json();
        const recap = data.choices?.[0]?.message?.content;

        if (!recap) {
            throw new Error('No recap generated from OpenAI API');
        }

        return recap.trim();
    } catch (error) {
        console.error('Error generating recap with OpenAI:', error);
        throw error;
    }
}

/**
 * Aggregate tweet text content into a single string
 * 
 * @param tweets - Array of tweet objects with text content
 * @returns Aggregated text content
 */
export function aggregateTweetContent(tweets: Array<{ text: string; created_at?: string }>): string {
    if (!tweets || tweets.length === 0) {
        return '';
    }

    // Sort by date if available (newest first)
    const sortedTweets = [...tweets].sort((a, b) => {
        if (!a.created_at || !b.created_at) return 0;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Aggregate text with separators
    return sortedTweets
        .map((tweet, index) => {
            const date = tweet.created_at
                ? new Date(tweet.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : '';
            return `[Post ${index + 1}${date ? ` - ${date}` : ''}]: ${tweet.text}`;
        })
        .join('\n\n');
}
