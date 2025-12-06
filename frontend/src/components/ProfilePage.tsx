import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User } from '../types/user';
import ProfileCard from './ProfileCard';
import Sidebar from './Sidebar';
import SocialNetworkGraph from './UI/SocialNetworkGraph';

export default function ProfilePage() {
    const { phoneNumber } = useParams<{ phoneNumber: string }>();
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (phoneNumber) {
            fetchProfile(phoneNumber);
        }
    }, [phoneNumber]);

    const fetchProfile = async (number: string) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/profile/${number}`);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Profile not found');
                }
                throw new Error('Failed to fetch profile');
            }
            const data = await response.json();
            setUser(data);
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
                <p>Loading profile...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="user-list__error">
                <p>Error: {error}</p>
                <button onClick={() => navigate('/')}>Go Home</button>
                {phoneNumber && (
                    <button onClick={() => fetchProfile(phoneNumber)}>Retry</button>
                )}
            </div>
        );
    }

    if (!user) {
        return (
            <div className="user-list__error">
                <p>Profile not found</p>
                <button onClick={() => navigate('/')}>Go Home</button>
            </div>
        );
    }

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
            <div className="profile-page">
                <ProfileCard user={user} onClose={() => navigate('/')} />
                {user.connections && user.connections.length > 0 && (
                    <div className="profile-page__graph-container">
                        <h3 className="profile-page__graph-title">Connections Network</h3>
                        <SocialNetworkGraph user={user} connections={user.connections} />
                    </div>
                )}
            </div>
        </div>
    );
}

