import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User } from '../types/user';
import { getUserDisplayName } from '../utils/userDisplay';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    phoneNumber?: string;
}

export default function Sidebar({ isOpen, onClose, phoneNumber }: SidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState<User | null>(null);

    // Check if we're on the profile preview page (home page)
    const isProfilePreviewPage = location.pathname === '/';

    useEffect(() => {
        const fetchUser = async () => {
            if (!phoneNumber || !isOpen) return;
            try {
                const response = await fetch(`/api/profile/${phoneNumber}`);
                if (response.ok) {
                    const data = await response.json();
                    setUser(data);
                }
            } catch (error) {
                console.error('Error fetching user for sidebar:', error);
            }
        };

        fetchUser();
    }, [phoneNumber, isOpen]);

    const handleEditProfile = () => {
        if (phoneNumber) {
            navigate(`/profile/${phoneNumber}/edit`);
        }
        onClose();
    };

    const handleViewProfile = () => {
        if (phoneNumber) {
            navigate(`/profile/${phoneNumber}`);
        }
        onClose();
    };

    const handleAvatarClick = () => {
        handleViewProfile();
    };

    const handleViewWrapped = () => {
        if (phoneNumber) {
            navigate(`/wrapped/${phoneNumber}`);
        }
        onClose();
    };

    const handleMessageAIFriend = () => {
        // Get sender number from environment variable
        const senderNumber = import.meta.env.VITE_SENDER_NUMBER;

        if (!senderNumber) {
            console.error('SENDER_NUMBER environment variable is not set');
            // Fallback: navigate to messages page if no sender number
            navigate('/messages');
            onClose();
            return;
        }

        // Use sms: URL scheme to open Messages app
        // Format: sms:+1234567890 or sms:1234567890
        const cleanNumber = senderNumber.replace(/\D/g, ''); // Remove non-digits
        window.location.href = `sms:${cleanNumber}`;

        onClose();
    };

    const displayName = getUserDisplayName(user);

    return (
        <>
            {isOpen && <div className="sidebar__overlay" onClick={onClose} />}
            <div className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
                <div className="sidebar__header">
                    <div className="sidebar__user">
                        <div
                            className="sidebar__user-avatar"
                            onClick={handleAvatarClick}
                            style={{ cursor: 'pointer' }}
                        >
                            {user?.profile_picture ? (
                                <img
                                    src={user.profile_picture}
                                    alt={displayName}
                                    className="sidebar__user-avatar-img"
                                />
                            ) : (
                                <span className="sidebar__user-avatar-initials">🌿</span>
                            )}
                        </div>
                        <div className="sidebar__user-info">
                            <div className="sidebar__user-name">{displayName}</div>
                            <div className="sidebar__user-link" onClick={handleViewProfile}>View profile</div>
                        </div>
                    </div>
                    <button className="sidebar__close" onClick={onClose}>
                        <span></span>
                        <span></span>
                    </button>
                </div>
                <nav className="sidebar__nav">
                    {!isProfilePreviewPage && (
                        <button className="sidebar__nav-item" onClick={handleEditProfile}>
                            <img src="/assets/icons/edit.png" alt="Edit" className="sidebar__nav-icon" />
                            <span>Edit profile</span>
                        </button>
                    )}
                    {!isProfilePreviewPage && (
                        <button className="sidebar__nav-item" onClick={handleViewWrapped}>
                            <img src="/assets/icons/gift.png" alt="Wrapped" className="sidebar__nav-icon" />
                            <span>View Wrapped</span>
                        </button>
                    )}
                    <button className="sidebar__nav-item" onClick={handleMessageAIFriend}>
                        <img src="/assets/icons/message.png" alt="Message" className="sidebar__nav-icon" />
                        <span>Message your AI friend</span>
                    </button>
                </nav>
            </div>
        </>
    );
}
