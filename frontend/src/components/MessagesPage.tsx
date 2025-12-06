import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';

interface Counterparty {
    phoneNumber: string;
    userId: number | null;
    user: {
        id: number;
        firstName: string;
        lastName: string;
        number: string;
    } | null;
}

interface Message {
    id: number;
    userId: number;
    user: {
        id: number;
        firstName: string;
        lastName: string;
        number: string;
    } | null;
    messageText: string;
    timestamp: string;
    counterpartyPhones: string[];
    counterparties: Counterparty[];
    createdAt: string;
}

interface MessagesResponse {
    messages: Message[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
    };
}

export default function MessagesPage() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState({
        total: 0,
        limit: 100,
        offset: 0,
        hasMore: false,
    });
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        fetchMessages(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (pagination.offset > 0) {
            fetchMessages();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pagination.offset]);

    const fetchMessages = async (offsetOverride?: number) => {
        try {
            setLoading(true);
            const currentOffset = offsetOverride !== undefined ? offsetOverride : pagination.offset;
            const params = new URLSearchParams({
                limit: pagination.limit.toString(),
                offset: currentOffset.toString(),
            });

            const response = await fetch(`/api/messages?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch messages');
            const data: MessagesResponse = await response.json();
            setMessages(data.messages);
            setPagination(data.pagination);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatPhoneNumber = (phone: string | null) => {
        if (!phone) return 'N/A';
        // Format as (XXX) XXX-XXXX if 10 digits, or keep as is
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        return phone;
    };

    if (loading && messages.length === 0) {
        return (
            <div className="user-list__loading">
                <div className="spinner"></div>
                <p>Loading messages...</p>
            </div>
        );
    }

    if (error && messages.length === 0) {
        return (
            <div className="user-list__error">
                <p>Error: {error}</p>
                <button onClick={() => fetchMessages()}>Retry</button>
            </div>
        );
    }

    return (
        <>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="user-list">
                <div className="user-list__header">
                    <button
                        className="user-list__menu-icon"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open menu"
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                    <h1>Messages</h1>
                    <div className="user-list__controls">
                        <button
                            className="user-list__create-btn"
                            onClick={() => navigate('/')}
                        >
                            ← Back to Users
                        </button>
                    </div>
                </div>

                <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', marginBottom: '1rem', borderRadius: '8px' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                        Total Messages <strong>{pagination.total}</strong> |
                        Showing: <strong>{messages.length}</strong>
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 1rem' }}>
                    {messages.length === 0 ? (
                        <div className="user-list__empty">
                            <p>No messages found.</p>
                        </div>
                    ) : (
                        messages.map((message) => (
                            <div
                                key={message.id}
                                style={{
                                    backgroundColor: 'white',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '8px',
                                    padding: '1rem',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <span style={{ color: '#666', fontSize: '0.9rem', fontWeight: '500' }}>From:</span>
                                        <span style={{ fontWeight: '600', color: '#333' }}>
                                            {message.user
                                                ? `${message.user.firstName} ${message.user.lastName}`.trim() || 'Unknown User'
                                                : 'Unknown User'}
                                        </span>
                                        <span style={{ color: '#999', fontSize: '0.85rem' }}>
                                            ({formatPhoneNumber(message.user?.number || null)})
                                        </span>

                                        {message.counterparties && message.counterparties.length > 0 && (
                                            <>
                                                <span style={{ color: '#ccc', margin: '0 0.25rem' }}>•</span>
                                                <span style={{ color: '#666', fontSize: '0.9rem', fontWeight: '500' }}>To:</span>
                                                {message.counterparties.map((cp, idx) => (
                                                    <span key={cp.phoneNumber} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                                        <span style={{ fontWeight: '600', color: '#333' }}>
                                                            {cp.user
                                                                ? `${cp.user.firstName} ${cp.user.lastName}`.trim() || formatPhoneNumber(cp.phoneNumber)
                                                                : formatPhoneNumber(cp.phoneNumber)}
                                                        </span>
                                                        <span style={{ color: '#999', fontSize: '0.85rem' }}>
                                                            ({formatPhoneNumber(cp.phoneNumber)})
                                                        </span>
                                                        {idx < message.counterparties.length - 1 && (
                                                            <span style={{ color: '#ccc', margin: '0 0.5rem' }}>,</span>
                                                        )}
                                                    </span>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#666', whiteSpace: 'nowrap' }}>
                                        {formatTimestamp(message.timestamp)}
                                    </div>
                                </div>
                                <div
                                    style={{
                                        padding: '0.75rem',
                                        backgroundColor: '#f8f9fa',
                                        borderRadius: '4px',
                                        marginTop: '0.5rem',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                    }}
                                >
                                    {message.messageText}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>
                                    Message ID: {message.id} | User ID: {message.userId} | Created: {formatTimestamp(message.createdAt)}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {pagination.hasMore && (
                    <div style={{ padding: '1rem', textAlign: 'center' }}>
                        <button
                            onClick={() => {
                                const newOffset = pagination.offset + pagination.limit;
                                setPagination(prev => ({ ...prev, offset: newOffset }));
                            }}
                            style={{
                                padding: '0.75rem 1.5rem',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                            }}
                        >
                            Load More
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
