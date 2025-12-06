import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types/user';
import Sidebar from './Sidebar';

export default function UserList() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/users');
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            setUsers(data);
            setError(null);
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
                <p>Loading users...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="user-list__error">
                <p>Error: {error}</p>
                <button onClick={fetchUsers}>Retry</button>
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
                    <h1>Profile Preview</h1>
                    <div className="user-list__controls">
                        <button
                            className="user-list__create-btn"
                            onClick={() => navigate('/messages')}
                        >
                            View Messages
                        </button>
                        <button
                            className="user-list__create-btn"
                            onClick={() => navigate('/create')}
                        >
                            Create Profile
                        </button>
                    </div>
                </div>

                <div className="user-list__grid">
                    {users.length === 0 ? (
                        <div className="user-list__empty">
                            <p>No users found. Create your first user!</p>
                        </div>
                    ) : (
                        users.map((user, index) => (
                            <div
                                key={user.id}
                                className="user-list__item"
                                onClick={() => navigate(`/profile/${user.number}`)}
                                onMouseEnter={() => setHoveredIndex(index)}
                                onMouseLeave={() => setHoveredIndex(null)}
                                style={{
                                    animationDelay: `${index * 0.05}s`
                                }}
                            >
                                <div className="user-list__item-avatar">
                                    {user.profile_picture ? (
                                        <img src={user.profile_picture} alt={`${user.first_name} ${user.last_name}`} />
                                    ) : (
                                        <span>{`${user.first_name[0]}${user.last_name[0]}`.toUpperCase()}</span>
                                    )}
                                </div>
                                <div className="user-list__item-info">
                                    <h3>{`${user.first_name} ${user.last_name}`}</h3>
                                    {user.location && <p className="user-list__item-location">{user.location}</p>}
                                </div>
                                {hoveredIndex === index && (
                                    <div className="user-list__item-arrow">→</div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}

