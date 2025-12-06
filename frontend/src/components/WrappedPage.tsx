import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GraphNodes from './UI/GraphNodes';
import WrappedSlides from './WrappedSlides';
import WrappedLogoAnimation from './UI/WrappedLogoAnimation';
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
            name: string | null;
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
    const [showLogoAnimation, setShowLogoAnimation] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');

    useEffect(() => {
        if (phoneNumber) {
            fetchWrapped(phoneNumber);
        }
    }, [phoneNumber]);

    // Add class to body when wrapped page is active
    useEffect(() => {
        document.body.classList.add('wrapped-active');
        return () => {
            document.body.classList.remove('wrapped-active');
        };
    }, []);

    const fetchWrapped = async (number: string) => {
        try {
            setLoading(true);
            setLoadingMessage('');

            // Set timeout for loading messages
            const timeout1 = setTimeout(() => {
                setLoadingMessage('Wait a second!');
            }, 2000);

            const timeout2 = setTimeout(() => {
                setLoadingMessage("We're just fetching your data...");
            }, 3000);

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

            // Clear timeouts
            clearTimeout(timeout1);
            clearTimeout(timeout2);
            setLoadingMessage('');

            // Log Twitter wrapped data for debugging
            if (data.twitterWrapped?.error) {
                console.log('Twitter wrapped error:', data.twitterWrapped.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
            setLoadingMessage('');
        }
    };

    if (loading) {
        return (
            <div className="wrapped-loading">
                <div className="wrapped-loading__graph">
                    <GraphNodes nodeCount={20} />
                </div>
                <div className="wrapped-loading__content">
                    <div className="wrapped-loading__spinner">
                        <div className="spinner"></div>
                    </div>
                    <p className="wrapped-loading__subtitle">Loading your wrapped...</p>
                    {loadingMessage && (
                        <p className="wrapped-loading__message">{loadingMessage}</p>
                    )}
                </div>
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

    const { user, statistics, twitterWrapped } = wrappedData;

    if (showLogoAnimation) {
        return (
            <WrappedLogoAnimation
                onComplete={() => setShowLogoAnimation(false)}
            />
        );
    }

    return (
        <div className="app">
            {!isSidebarOpen && (
                <button
                    className="wrapped-page__menu-btn"
                    onClick={() => setIsSidebarOpen(true)}
                >
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            )}
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                phoneNumber={phoneNumber || undefined}
            />
            <div className="wrapped-page">
                <WrappedSlides
                    statistics={{
                        totalMessages: statistics.totalMessages,
                        messagesSent: statistics.messagesSent,
                        messagesReceived: statistics.messagesReceived,
                    }}
                    twitterRecap={twitterWrapped?.weeklyRecap || null}
                    userName={`${user.firstName} ${user.lastName}`}
                    phoneNumber={phoneNumber || undefined}
                    allStatistics={{
                        connectionCount: statistics.connectionCount,
                        averageMessageLength: statistics.averageMessageLength,
                        longestMessage: statistics.longestMessage,
                        dateRange: statistics.dateRange,
                        mostActiveDay: statistics.mostActiveDay,
                    }}
                    breakdown={wrappedData.breakdown}
                />
            </div>
        </div>
    );
}
