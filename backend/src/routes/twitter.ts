import { Router } from 'express';
import { generateWeeklyRecap, aggregateTweetContent } from '../services/llm.js';

const router = Router();

// Type definitions for Twitter API responses
export interface TwitterUser {
    id: string;
    name: string;
    username: string;
    description?: string;
    profile_image_url?: string;
    public_metrics?: {
        followers_count: number;
        following_count: number;
        tweet_count: number;
        listed_count: number;
    };
    created_at?: string;
    verified?: boolean;
}

interface TwitterUserResponse {
    data?: TwitterUser;
    errors?: Array<{ message: string; code: number }>;
}

export interface TwitterTweet {
    id: string;
    text: string;
    created_at: string;
    public_metrics?: {
        retweet_count: number;
        like_count: number;
        reply_count: number;
        quote_count: number;
    };
    author_id?: string;
    lang?: string;
}

interface TwitterTweetsResponse {
    data?: TwitterTweet[];
    meta?: {
        result_count: number;
        next_token?: string;
    };
    includes?: {
        users?: TwitterUser[];
    };
    errors?: Array<{ message: string; code: number }>;
}

/**
 * Extract username from Twitter/X URL
 * Supports formats:
 * - https://twitter.com/username
 * - https://www.twitter.com/username
 * - https://x.com/username
 * - https://www.x.com/username
 * - twitter.com/username
 * - x.com/username
 * - @username
 * - username
 */
export function extractUsername(url: string | null): string | null {
    if (!url) return null;

    // Remove @ if present
    let cleaned = url.trim().replace(/^@/, '');

    // Extract username from URL patterns
    const patterns = [
        /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/,
        /^([a-zA-Z0-9_]+)$/,
    ];

    for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

/**
 * Get Twitter bearer token from environment
 */
function getBearerToken(): string | null {
    return process.env.TWITTER_BEARER_TOKEN || null;
}

/**
 * Fetch Twitter user data by username
 */
export async function fetchTwitterUser(username: string): Promise<TwitterUser | null> {
    const bearerToken = getBearerToken();
    if (!bearerToken) {
        throw new Error('TWITTER_BEARER_TOKEN environment variable is not set');
    }

    const userResponse = await fetch(
        `https://api.x.com/2/users/by/username/${username}?user.fields=id,name,username,description,profile_image_url,public_metrics,created_at,verified`,
        {
            headers: {
                'Authorization': `Bearer ${bearerToken}`,
            },
        }
    );

    if (!userResponse.ok) {
        if (userResponse.status === 404) {
            return null;
        }
        if (userResponse.status === 429) {
            const retryAfter = userResponse.headers.get('x-rate-limit-reset');
            const error = new Error('Twitter API rate limit exceeded');
            (error as any).isRateLimit = true;
            (error as any).retryAfter = retryAfter ? new Date(parseInt(retryAfter) * 1000).toISOString() : null;
            throw error;
        }
        const errorData = await userResponse.json().catch(() => ({}));
        throw new Error(`Failed to fetch Twitter user: ${JSON.stringify(errorData)}`);
    }

    const userData = await userResponse.json() as TwitterUserResponse;
    return userData.data || null;
}

/**
 * Fetch recent tweets for a username within a time period
 */
export async function fetchRecentTweets(
    username: string,
    daysBack: number = 7,
    maxResults: number = 10
): Promise<TwitterTweet[]> {
    const bearerToken = getBearerToken();
    if (!bearerToken) {
        throw new Error('TWITTER_BEARER_TOKEN environment variable is not set');
    }

    // Calculate start_time (ISO 8601 format required by Twitter API)
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - daysBack);
    const startTimeISO = startTime.toISOString();

    const searchQuery = `from:${username}`;
    const tweetsResponse = await fetch(
        `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(searchQuery)}&start_time=${encodeURIComponent(startTimeISO)}&max_results=${maxResults}&tweet.fields=id,text,created_at,public_metrics,author_id,lang&expansions=author_id&user.fields=id,name,username`,
        {
            headers: {
                'Authorization': `Bearer ${bearerToken}`,
            },
        }
    );

    if (!tweetsResponse.ok) {
        // Handle rate limiting
        if (tweetsResponse.status === 429) {
            const retryAfter = tweetsResponse.headers.get('x-rate-limit-reset');
            const error = new Error('Twitter API rate limit exceeded');
            (error as any).isRateLimit = true;
            (error as any).retryAfter = retryAfter ? new Date(parseInt(retryAfter) * 1000).toISOString() : null;
            throw error;
        }
        const errorData = await tweetsResponse.json().catch(() => ({}));
        console.error('Failed to fetch tweets:', errorData);
        // For non-rate-limit errors, throw an error with details
        const errorMessage = (errorData as any)?.detail || (errorData as any)?.title || (errorData as any)?.message || 'Unknown error';
        const error = new Error(`Failed to fetch tweets: ${errorMessage}`);
        (error as any).statusCode = tweetsResponse.status;
        throw error;
    }

    const tweetsData = await tweetsResponse.json() as TwitterTweetsResponse;
    return tweetsData.data || [];
}

/**
 * GET /api/twitter/user/:username
 * Get Twitter user profile and recent posts
 * 
 * Query params:
 *   - url: Twitter profile URL (alternative to path param)
 *   - period: Time period for tweets - 'daily' (last 1 day), 'weekly' (last 7 days), or 'monthly' (last 30 days)
 *             Default: 'daily' (to minimize API usage)
 */
router.get('/user/:username?', async (req, res) => {
    try {
        const { username: pathUsername } = req.params;
        const urlParam = req.query.url as string | undefined;
        const periodParam = (req.query.period as string) || 'daily';

        // Get username from path param or query param
        let username: string | null = null;

        if (pathUsername) {
            username = extractUsername(pathUsername);
        } else if (urlParam) {
            username = extractUsername(urlParam);
        }

        if (!username) {
            return res.status(400).json({
                error: 'Invalid Twitter URL or username',
                message: 'Please provide a valid Twitter URL (e.g., https://twitter.com/username) or username',
            });
        }

        // Validate and calculate time period
        let daysBack: number;
        let periodName: string;

        switch (periodParam.toLowerCase()) {
            case 'daily':
                daysBack = 1;
                periodName = 'last 1 day';
                break;
            case 'weekly':
                daysBack = 7;
                periodName = 'last 7 days';
                break;
            case 'monthly':
                daysBack = 30;
                periodName = 'last 30 days';
                break;
            default:
                return res.status(400).json({
                    error: 'Invalid period parameter',
                    message: "Period must be 'daily', 'weekly', or 'monthly'",
                });
        }

        // Calculate start_time (ISO 8601 format required by Twitter API)
        const startTime = new Date();
        startTime.setDate(startTime.getDate() - daysBack);
        const startTimeISO = startTime.toISOString();

        console.log(`\n🔍 Fetching Twitter profile for: @${username}`);

        // Step 1: Get user by username
        const twitterUser = await fetchTwitterUser(username);

        if (!twitterUser) {
            return res.status(404).json({
                error: 'User not found',
                message: `Twitter user @${username} not found`,
            });
        }

        console.log('✅ User Profile Found:');
        console.log(JSON.stringify(twitterUser, null, 2));

        // Step 2: Get recent tweets using Recent Search endpoint
        // GET /2/tweets/search/recent - Search for Tweets published in the last 7 days
        // This endpoint supports OAuth 2.0 App Only (Bearer Token) ✅
        // TODO: Consider implementing rate limiting/caching to avoid hitting Twitter API limits
        //       The default period is set to 'daily' (1 day) to minimize API quota usage
        console.log(`\n📱 Fetching recent tweets for @${username} using search endpoint (${periodName})`);

        // Using search endpoint with "from:username" query and start_time filter
        // This searches for tweets from the user within the specified time period
        const tweets = await fetchRecentTweets(username, daysBack, 1);
        const tweetsData = { data: tweets, meta: { result_count: tweets.length } };

        console.log('\n📝 Recent Posts:');
        console.log(`Total tweets found: ${tweets.length}`);

        if (tweets.length > 0) {
            tweets.forEach((tweet, index: number) => {
                console.log(`\n--- Tweet ${index + 1} ---`);
                console.log(`ID: ${tweet.id}`);
                console.log(`Text: ${tweet.text}`);
                console.log(`Created: ${tweet.created_at}`);
                console.log(`Metrics:`, JSON.stringify(tweet.public_metrics, null, 2));
                console.log(`Language: ${tweet.lang}`);
            });
        } else {
            console.log('No recent tweets found');
        }

        // Aggregate tweet content for potential recap generation
        const aggregatedContent = tweets.length > 0
            ? aggregateTweetContent(tweets)
            : '';

        // Return response
        res.json({
            success: true,
            user: twitterUser,
            period: {
                type: periodParam.toLowerCase(),
                name: periodName,
                startTime: startTimeISO,
            },
            tweets: {
                data: tweets,
                meta: { result_count: tweets.length },
                includes: {},
            },
            aggregatedContent: aggregatedContent, // For use in recap generation
            message: `Successfully fetched profile and ${tweets.length} recent tweets for @${username} (${periodName})`,
        });

    } catch (error) {
        console.error('❌ Error fetching Twitter data:', error);

        // Handle rate limit errors specifically
        const isRateLimit = (error as any)?.isRateLimit === true;
        const retryAfter = (error as any)?.retryAfter;

        if (isRateLimit) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                message: 'Twitter API rate limit exceeded. Please try again later.',
                retryAfter: retryAfter || null,
            });
        }

        // Handle specific error types
        if (error instanceof Error && error.message.includes('TWITTER_BEARER_TOKEN')) {
            return res.status(500).json({
                error: 'Twitter API not configured',
                message: 'TWITTER_BEARER_TOKEN environment variable is not set',
            });
        }

        res.status(500).json({
            error: 'Failed to fetch Twitter data',
            message: error instanceof Error ? error.message : 'Unknown error',
            details: error instanceof Error ? error.stack : 'Unknown error',
        });
    }
});

/**
 * POST /api/twitter/generate-recap
 * Generate a weekly recap from Twitter posts
 * Body: { 
 *   tweets: Array<{ text: string, created_at?: string }>,
 *   context?: string,
 *   maxWords?: number
 * }
 */
router.post('/generate-recap', async (req, res) => {
    try {
        const { tweets, context, maxWords } = req.body;

        if (!tweets || !Array.isArray(tweets) || tweets.length === 0) {
            return res.status(400).json({
                error: 'Tweets array is required',
                message: 'Please provide an array of tweets with text content',
            });
        }

        // Aggregate tweet content
        const aggregatedContent = aggregateTweetContent(tweets);

        if (!aggregatedContent) {
            return res.status(400).json({
                error: 'No valid tweet content found',
                message: 'Tweets must have text content',
            });
        }

        // Generate recap using LLM
        const recap = await generateWeeklyRecap({
            textContent: aggregatedContent,
            context,
            maxWords: maxWords || 200,
        });

        res.json({
            success: true,
            recap,
            tweetCount: tweets.length,
            wordCount: recap.split(/\s+/).length,
        });
    } catch (error) {
        console.error('❌ Error generating recap:', error);
        res.status(500).json({
            error: 'Failed to generate recap',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * POST /api/twitter/search
 * Alternative endpoint that accepts Twitter URL in request body
 * Body: { url: "https://twitter.com/username" }
 */
router.post('/search', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                error: 'URL is required',
                message: 'Please provide a Twitter URL in the request body: { "url": "https://twitter.com/username" }',
            });
        }

        const username = extractUsername(url);

        if (!username) {
            return res.status(400).json({
                error: 'Invalid Twitter URL',
                message: 'Could not extract username from the provided URL',
            });
        }

        // Redirect to GET endpoint
        return res.redirect(`/api/twitter/user/${username}`);
    } catch (error) {
        console.error('❌ Error processing Twitter search:', error);
        res.status(500).json({
            error: 'Failed to process Twitter search',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

export default router;
