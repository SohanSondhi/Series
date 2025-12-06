import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';

interface WrappedData {
    user: {
        id: number;
        firstName: string;
        lastName: string;
        phoneNumber: string;
    };
    statistics: {
        totalMessages: number;
        messagesSent: number;
        messagesReceived: number;
        connectionCount: number;
        averageMessageLength: number;
        longestMessage: {
            text: string;
            length: number;
            timestamp: string;
        } | null;
        dateRange: {
            firstMessage: string;
            lastMessage: string;
        } | null;
        mostActiveDay: {
            date: string;
            messageCount: number;
        } | null;
    };
    breakdown: {
        topContacts: Array<{
            phoneNumber: string;
            messageCount: number;
        }>;
        messagesByDayOfWeek: Array<{
            day: string;
            dayNumber: number;
            count: number;
        }>;
        messagesByHour: Array<{
            hour: number;
            count: number;
        }>;
    };
    twitterWrapped: {
        user: {
            username: string;
            name: string;
            profileImageUrl?: string;
            verified: boolean;
        } | null;
        weeklyRecap: string | null;
        message?: string;
        error?: {
            type: 'rate_limit' | 'api_error';
            message: string;
            retryAfter?: string | null;
        };
    } | null;
}

export default function WrappedPage() {
    const { phoneNumber } = useParams<{ phoneNumber: string }>();
    const navigate = useNavigate();
    const [wrappedData, setWrappedData] = useState<WrappedData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (phoneNumber) {
            fetchWrapped(phoneNumber);
        }
    }, [phoneNumber]);

    const fetchWrapped = async (number: string) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/wrapped/${number}`);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('User not found');
                }
                throw new Error('Failed to fetch wrapped data');
            }
            const data = await response.json();
            setWrappedData(data);
            setError(null);

            // Log Twitter wrapped data for debugging
            if (data.twitterWrapped?.error) {
                console.log('Twitter wrapped error:', data.twitterWrapped.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="user-list__loading">
                <div className="spinner"></div>
                <p>Loading your wrapped...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="user-list__error">
                <p>Error: {error}</p>
                <button onClick={() => navigate('/')}>Go Home</button>
                {phoneNumber && (
                    <button onClick={() => fetchWrapped(phoneNumber)}>Retry</button>
                )}
            </div>
        );
    }

    if (!wrappedData) {
        return (
            <div className="user-list__error">
                <p>No wrapped data found</p>
                <button onClick={() => navigate('/')}>Go Home</button>
            </div>
        );
    }

    const { user, statistics, breakdown, twitterWrapped } = wrappedData;

    return (
        <div className="app">
            {!isSidebarOpen && (
                <button
                    className="profile-page__menu-btn"
                    onClick={() => setIsSidebarOpen(true)}
                >
                    <span></span>
                    <span></span>
                </button>
            )}
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                phoneNumber={phoneNumber}
            />
            <div className="wrapped-page">
                <div className="wrapped-page__header">
                    <h1>Your Wrapped</h1>
                    <p className="wrapped-page__subtitle">
                        {user.firstName} {user.lastName}'s Year in Review
                    </p>
                </div>

                <div className="wrapped-page__content">
                    {/* Messages Statistics Section */}
                    <section className="wrapped-section">
                        <h2 className="wrapped-section__title">Messages</h2>
                        <div className="wrapped-section__stats">
                            <div className="wrapped-stat-card">
                                <div className="wrapped-stat-card__value">{statistics.totalMessages}</div>
                                <div className="wrapped-stat-card__label">Total Messages</div>
                            </div>
                            <div className="wrapped-stat-card">
                                <div className="wrapped-stat-card__value">{statistics.messagesSent}</div>
                                <div className="wrapped-stat-card__label">Sent</div>
                            </div>
                            <div className="wrapped-stat-card">
                                <div className="wrapped-stat-card__value">{statistics.messagesReceived}</div>
                                <div className="wrapped-stat-card__label">Received</div>
                            </div>
                            <div className="wrapped-stat-card">
                                <div className="wrapped-stat-card__value">{statistics.averageMessageLength}</div>
                                <div className="wrapped-stat-card__label">Avg Length</div>
                            </div>
                        </div>
                    </section>

                    {/* Twitter Wrapped Section */}
                    {twitterWrapped && (
                        <section className="wrapped-section wrapped-section--twitter">
                            <h2 className="wrapped-section__title">Twitter Wrapped</h2>

                            {/* Show error as a notice banner if present, but still show recap below */}
                            {twitterWrapped.error && (
                                <div style={{
                                    backgroundColor: '#fff3cd',
                                    border: '1px solid #ffc107',
                                    borderRadius: '8px',
                                    padding: '0.75rem 1rem',
                                    marginBottom: '1.5rem',
                                    fontSize: '0.9rem',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                        <span>⚠️</span>
                                        <strong style={{ color: '#856404' }}>Note:</strong>
                                    </div>
                                    <p style={{ margin: 0, color: '#856404' }}>
                                        {twitterWrapped.error.message}
                                        {twitterWrapped.error.type === 'rate_limit' && twitterWrapped.error.retryAfter && (
                                            <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                                                You can try again after: {new Date(twitterWrapped.error.retryAfter).toLocaleString()}
                                            </span>
                                        )}
                                    </p>
                                </div>
                            )}

                            {/* Always show user profile if available */}
                            {twitterWrapped.user && (
                                <div className="twitter-wrapped__profile">
                                    <div className="twitter-wrapped__profile-header">
                                        {twitterWrapped.user.profileImageUrl && (
                                            <img
                                                src={twitterWrapped.user.profileImageUrl}
                                                alt={twitterWrapped.user.name}
                                                className="twitter-wrapped__avatar"
                                            />
                                        )}
                                        <div>
                                            <h3 className="twitter-wrapped__name">
                                                {twitterWrapped.user.name}
                                                {twitterWrapped.user.verified && (
                                                    <span className="twitter-wrapped__verified">✓</span>
                                                )}
                                            </h3>
                                            <p className="twitter-wrapped__username">@{twitterWrapped.user.username}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Always show recap if available */}
                            {twitterWrapped.weeklyRecap ? (
                                <div className="twitter-wrapped__recap">
                                    <h3 className="twitter-wrapped__recap-title">Your Weekly Recap</h3>
                                    <div className="twitter-wrapped__recap-content">
                                        {twitterWrapped.weeklyRecap.split('\n').map((paragraph, index) => (
                                            paragraph.trim() && (
                                                <p key={index} className="twitter-wrapped__recap-paragraph">
                                                    {paragraph.trim()}
                                                </p>
                                            )
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="twitter-wrapped__no-recap">
                                    <p>{twitterWrapped.message || 'Unable to generate weekly recap. No recent tweets found.'}</p>
                                </div>
                            )}
                        </section>
                    )}

                    {/* Top Contacts Section */}
                    {breakdown.topContacts.length > 0 && (
                        <section className="wrapped-section">
                            <h2 className="wrapped-section__title">Top Contacts</h2>
                            <div className="wrapped-section__contacts">
                                {breakdown.topContacts.map((contact, index) => (
                                    <div key={contact.phoneNumber} className="wrapped-contact">
                                        <span className="wrapped-contact__rank">#{index + 1}</span>
                                        <span className="wrapped-contact__phone">{contact.phoneNumber}</span>
                                        <span className="wrapped-contact__count">{contact.messageCount} messages</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}
