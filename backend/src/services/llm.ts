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
        context,
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

    const prompt = `### Task
Analyze the user's posts and produce a weekly recap that highlights:
- Their most important events, thoughts, or updates
- Key themes or recurring topics
- Notable insights or moments

### Output Format (strict)
Provide **exactly three** bullet points.  
Each bullet point should:
- Begin with "•"
- Contain a short, engaging summary
- Include *italicized* emphasis on one key phrase
- Be written in a friendly, conversational tone

### Rules
- Do **not** include any heading or title.
- Do **not** include an intro or summary sentence before the bullets.
- Do **not** include any closing or well-wishing statements.
- Do **not** repeat content.
- Only use the user’s name if it is provided and is not "Unknown User".
- You should in no circustances write this in second or first person. Should be in third person.
- Do not fabricate details not supported by the posts.
- Keep the entire output under ${maxWords} words.

${context ? `### User Context: ${context}` : ''}

### User’s Aggregated Post Content
${textContent}

Please generate the weekly recap now.`;

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
                (errorData as any).error ||
                `Llama API error: ${response.status} ${response.statusText}`
            );
        }

        const data = await response.json() as { response: string };
        const recap = data.response as string;

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
