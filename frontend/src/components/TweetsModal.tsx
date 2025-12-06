import { useState, useEffect, useCallback } from 'react';

interface Tweet {
    id: string;
    text: string;
    created_at: string;
    public_metrics?: {
        retweet_count: number;
        like_count: number;
        reply_count: number;
        quote_count: number;
    };
    lang?: string;
}

interface TwitterUser {
    id: string;
    name: string;
    username: string;
    description?: string;
    profile_image_url?: string;
    verified?: boolean;
}

interface TweetsModalProps {
    twitterUrl: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function TweetsModal({ twitterUrl, isOpen, onClose }: TweetsModalProps) {
    const [tweets, setTweets] = useState<Tweet[]>([]);
    const [user, setUser] = useState<TwitterUser | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTweets = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Extract username from URL or use as-is
            const username = extractUsername(twitterUrl);
            if (!username) {
                throw new Error('Invalid Twitter URL');
            }

            const response = await fetch(`/api/twitter/user/${username}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));

                // Handle rate limit error specifically
                if (response.status === 429) {
                    throw new Error('RATE_LIMIT: Sorry, we\'ve reached the rate limit of developer requests :( Come back in 15 minutes.');
                }

                throw new Error(errorData.message || errorData.error || 'Failed to fetch tweets');
            }

            const data = await response.json();
            setUser(data.user);
            setTweets(data.tweets?.data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    }, [twitterUrl]);

    useEffect(() => {
        if (isOpen && twitterUrl) {
            fetchTweets();
        }
    }, [isOpen, twitterUrl, fetchTweets]);

    const extractUsername = (url: string): string | null => {
        // Remove @ if present
        const cleaned = url.trim().replace(/^@/, '');

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
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '1rem',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    maxWidth: '600px',
                    width: '100%',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '1.5rem',
                        borderBottom: '1px solid #e1e8ed',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        position: 'sticky',
                        top: 0,
                        backgroundColor: 'white',
                        zIndex: 10,
                    }}
                >
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
                            {user ? `${user.name}'s Tweets` : 'Twitter Posts'}
                        </h2>
                        {user && (
                            <p style={{ margin: '0.25rem 0 0 0', color: '#657786', fontSize: '0.9rem' }}>
                                @{user.username}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            color: '#657786',
                        }}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '1.5rem' }}>
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <div className="spinner"></div>
                            <p style={{ marginTop: '1rem', color: '#657786' }}>Loading tweets...</p>
                        </div>
                    )}

                    {error && (
                        <div
                            style={{
                                padding: '1.5rem',
                                backgroundColor: error.includes('RATE_LIMIT') ? '#fff3cd' : '#fee',
                                border: `1px solid ${error.includes('RATE_LIMIT') ? '#ffc107' : '#fcc'}`,
                                borderRadius: '8px',
                                color: error.includes('RATE_LIMIT') ? '#856404' : '#c33',
                                textAlign: 'center',
                            }}
                        >
                            <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '500' }}>
                                {error.includes('RATE_LIMIT')
                                    ? error.replace('RATE_LIMIT: ', '')
                                    : `Error: ${error}`
                                }
                            </p>
                            {!error.includes('RATE_LIMIT') && (
                                <button
                                    onClick={fetchTweets}
                                    style={{
                                        marginTop: '0.5rem',
                                        padding: '0.5rem 1rem',
                                        backgroundColor: '#1da1f2',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Retry
                                </button>
                            )}
                        </div>
                    )}

                    {!loading && !error && tweets.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#657786' }}>
                            <p>No tweets found for this user.</p>
                        </div>
                    )}

                    {!loading && !error && tweets.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {tweets.map((tweet) => (
                                <div
                                    key={tweet.id}
                                    style={{
                                        padding: '1rem',
                                        border: '1px solid #e1e8ed',
                                        borderRadius: '8px',
                                        backgroundColor: '#f7f9fa',
                                    }}
                                >
                                    <div style={{ marginBottom: '0.5rem' }}>
                                        <p
                                            style={{
                                                margin: 0,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                lineHeight: '1.5',
                                            }}
                                        >
                                            {tweet.text}
                                        </p>
                                    </div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            fontSize: '0.85rem',
                                            color: '#657786',
                                            marginTop: '0.75rem',
                                            paddingTop: '0.75rem',
                                            borderTop: '1px solid #e1e8ed',
                                        }}
                                    >
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            {tweet.public_metrics && (
                                                <>
                                                    {tweet.public_metrics.like_count > 0 && (
                                                        <span>❤️ {tweet.public_metrics.like_count}</span>
                                                    )}
                                                    {tweet.public_metrics.retweet_count > 0 && (
                                                        <span>🔄 {tweet.public_metrics.retweet_count}</span>
                                                    )}
                                                    {tweet.public_metrics.reply_count > 0 && (
                                                        <span>💬 {tweet.public_metrics.reply_count}</span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        <span>{formatDate(tweet.created_at)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
