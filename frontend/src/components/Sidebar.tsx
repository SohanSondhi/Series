import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types/user';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    phoneNumber?: string;
}

export default function Sidebar({ isOpen, onClose, phoneNumber }: SidebarProps) {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);

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
        // Check if we're on an Apple device (macOS or iOS)
        const isAppleDevice = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

        if (isAppleDevice && phoneNumber) {
            // Use sms: URL scheme to open Messages app on Apple devices
            // Format: sms:+1234567890 or sms:1234567890
            const cleanNumber = phoneNumber.replace(/\D/g, ''); // Remove non-digits
            window.location.href = `sms:${cleanNumber}`;
        } else if (phoneNumber) {
            // For non-Apple devices, try sms: scheme (works on Android too)
            const cleanNumber = phoneNumber.replace(/\D/g, '');
            window.location.href = `sms:${cleanNumber}`;
        } else {
            // Fallback: navigate to messages page if no phone number
            navigate('/messages');
        }
        onClose();
    };

    const fullName = user ? `${user.first_name} ${user.last_name}` : 'Sabrina Do';
    const initials = user ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase() : 'SD';

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
                                    alt={fullName}
                                    className="sidebar__user-avatar-img"
                                />
                            ) : (
                                <span className="sidebar__user-avatar-initials">{initials}</span>
                            )}
                        </div>
                        <div className="sidebar__user-info">
                            <div className="sidebar__user-name">{fullName}</div>
                            <div className="sidebar__user-link" onClick={handleViewProfile}>View profile</div>
                        </div>
                    </div>
                    <button className="sidebar__close" onClick={onClose}>
                        <span></span>
                        <span></span>
                    </button>
                </div>
                <nav className="sidebar__nav">
                    <button className="sidebar__nav-item" onClick={handleEditProfile}>
                        <img src="/assets/icons/edit.png" alt="Edit" className="sidebar__nav-icon" />
                        <span>Edit profile</span>
                    </button>
                    <button className="sidebar__nav-item" onClick={handleViewWrapped}>
                        <img src="/assets/icons/gift.png" alt="Wrapped" className="sidebar__nav-icon" />
                        <span>View Wrapped</span>
                    </button>
                    <button className="sidebar__nav-item" onClick={handleMessageAIFriend}>
                        <img src="/assets/icons/message.png" alt="Message" className="sidebar__nav-icon" />
                        <span>Message your AI friend</span>
                    </button>
                </nav>
            </div>
        </>
    );
}
