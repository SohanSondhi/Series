import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';

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
    direction: 'inbound' | 'outbound';
    timestamp: string;
    counterpartyPhone: string | null;
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
    const [filterDirection, setFilterDirection] = useState<'all' | 'inbound' | 'outbound'>('all');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        setPagination(prev => ({ ...prev, offset: 0 }));
        fetchMessages(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterDirection]);

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

            if (filterDirection !== 'all') {
                params.append('direction', filterDirection);
            }

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
                <button onClick={() => fetchMessages()  }>Retry</button>
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
                        <div style={{ marginLeft: '1rem', display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => {
                                    setFilterDirection('all');
                                }}
                                style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: filterDirection === 'all' ? '#007bff' : '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                }}
                            >
                                All
                            </button>
                            <button
                                onClick={() => {
                                    setFilterDirection('inbound');
                                }}
                                style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: filterDirection === 'inbound' ? '#28a745' : '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                }}
                            >
                                Inbound
                            </button>
                            <button
                                onClick={() => {
                                    setFilterDirection('outbound');
                                }}
                                style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: filterDirection === 'outbound' ? '#ffc107' : '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                }}
                            >
                                Outbound
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', marginBottom: '1rem', borderRadius: '8px' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                        Total Messages: <strong>{pagination.total}</strong> |
                        Showing: <strong>{messages.length}</strong> |
                        Direction: <strong>{filterDirection === 'all' ? 'All' : filterDirection}</strong>
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                            <span
                                                style={{
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 'bold',
                                                    backgroundColor: message.direction === 'outbound' ? '#ffc107' : '#28a745',
                                                    color: 'white',
                                                }}
                                            >
                                                {message.direction.toUpperCase()}
                                            </span>
                                            {message.user && (
                                                <span style={{ fontWeight: 'bold' }}>
                                                    {message.user.firstName} {message.user.lastName}
                                                </span>
                                            )}
                                            <span style={{ color: '#666', fontSize: '0.9rem' }}>
                                                ({formatPhoneNumber(message.user?.number || null)})
                                            </span>
                                        </div>
                                        {message.counterpartyPhone && (
                                            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                                                To/From: {formatPhoneNumber(message.counterpartyPhone)}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#666', textAlign: 'right' }}>
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
