import { useState } from 'react';
import { User } from '../types/user';
import TweetsModal from './TweetsModal';

interface ProfileCardProps {
    user: User;
    onClose?: () => void;
}

export default function ProfileCard({ user, onClose }: ProfileCardProps) {
    const fullName = `${user.first_name} ${user.last_name}`;
    const [isTweetsModalOpen, setIsTweetsModalOpen] = useState(false);
    const [isBioSelected, setIsBioSelected] = useState(false);

    return (
        <div className="profile-card">
            {onClose && (
                <button className="profile-card__close" onClick={onClose} aria-label="Close">
                    ×
                </button>
            )}

            <div className="profile-card__header">
                <h2 className="profile-card__name">{fullName}</h2>
            </div>

            <div className="profile-card__picture-container">
                {user.profile_picture ? (
                    <img
                        src={user.profile_picture}
                        alt={fullName}
                        className="profile-card__picture"
                    />
                ) : (
                    <div className="profile-card__picture-placeholder">
                        <span className="profile-card__initials">{fullName}</span>
                    </div>
                )}
            </div>

            <div className="profile-card__content">
                <div
                    className={`profile-card__section ${isBioSelected ? 'profile-card__section--selected' : ''}`}
                    onClick={() => setIsBioSelected(!isBioSelected)}
                    style={{ cursor: 'pointer' }}
                >
                    <h3 className="profile-card__section-title">BIO</h3>
                    <p className="profile-card__bio">
                        {user.bio || 'No bio available'}
                    </p>
                </div>

                {user.weekly_recap && (
                    <div className="profile-card__section">
                        <h3 className="profile-card__section-title">WEEKLY RECAP</h3>
                        <p className="profile-card__bio">
                            {user.weekly_recap}
                        </p>
                    </div>
                )}

                <div className="profile-card__info">
                    {user.location && (
                        <div className="profile-card__info-item">
                            <span className="profile-card__info-label">📍 Location</span>
                            <span className="profile-card__info-value">{user.location}</span>
                        </div>
                    )}

                    {user.number && (
                        <div className="profile-card__info-item">
                            <span className="profile-card__info-label">📱 Number</span>
                            <span className="profile-card__info-value">{user.number}</span>
                        </div>
                    )}
                </div>

                <div className="profile-card__social">
                    {user.linkedin && (
                        <a
                            href={user.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="profile-card__social-link profile-card__social-link--linkedin"
                            aria-label="LinkedIn"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                            </svg>
                        </a>
                    )}
                    {user.twitter && (
                        <button
                            onClick={() => setIsTweetsModalOpen(true)}
                            className="profile-card__social-link"
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'inherit',
                            }}
                            aria-label="Get Tweets"
                            title="Get Tweets"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                        </button>
                    )}
                </div>

                {user.twitter && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e1e8ed' }}>
                        <button
                            onClick={() => setIsTweetsModalOpen(true)}
                            style={{
                                width: '100%',
                                padding: '0.75rem 1.5rem',
                                backgroundColor: '#1da1f2',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = '#1a91da';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = '#1da1f2';
                            }}
                        >
                            🐦 Get Tweets
                        </button>
                    </div>
                )}

                {user.twitter && (
                    <TweetsModal
                        twitterUrl={user.twitter}
                        isOpen={isTweetsModalOpen}
                        onClose={() => setIsTweetsModalOpen(false)}
                    />
                )}
            </div>
        </div>
    );
}

