import { useState, useEffect } from 'react';
import { User } from '../types/user';
import ProfileCard from './ProfileCard';

export default function UserList() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

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
        <div className="user-list">
            <div className="user-list__header">
                <h1>Profile Preview</h1>
                <div className="user-list__controls">
                    <span className="user-list__hint">SCROLL TO ZOOM</span>
                </div>
            </div>

            {selectedUser ? (
                <div className="user-list__selected">
                    <ProfileCard user={selectedUser} onClose={() => setSelectedUser(null)} />
                </div>
            ) : (
                <div className="user-list__grid">
                    {users.length === 0 ? (
                        <div className="user-list__empty">
                            <p>No users found. Create your first user!</p>
                        </div>
                    ) : (
                        users.map((user) => (
                            <div
                                key={user.id}
                                className="user-list__item"
                                onClick={() => setSelectedUser(user)}
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
                                    {user.location && <p className="user-list__item-location">📍 {user.location}</p>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

