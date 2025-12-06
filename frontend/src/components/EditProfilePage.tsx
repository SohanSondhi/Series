import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User } from '../types/user';
import Sidebar from './Sidebar';

export default function EditProfilePage() {
    const { phoneNumber } = useParams<{ phoneNumber: string }>();
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        number: '',
        age: '',
        location: '',
        bio: '',
        profile_picture: '',
        instagram: '',
        twitter: '',
        linkedin: '',
    });
    const [urlErrors, setUrlErrors] = useState({
        instagram: '',
        twitter: '',
        linkedin: '',
    });
    const fileInputRef = React.useRef<HTMLInputElement>(null);

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
            setFormData({
                first_name: data.first_name || '',
                last_name: data.last_name || '',
                number: data.number || '',
                age: data.age?.toString() || '',
                location: data.location || '',
                bio: data.bio || '',
                profile_picture: data.profile_picture || '',
                instagram: data.instagram || '',
                twitter: data.twitter || '',
                linkedin: data.linkedin || '',
            });
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const validateUrl = (url: string, type: 'instagram' | 'twitter' | 'linkedin'): string => {
        if (!url) return '';

        const urlPattern = /^https?:\/\/.+/;
        if (!urlPattern.test(url)) {
            return 'Please enter a valid URL starting with http:// or https://';
        }

        switch (type) {
            case 'linkedin':
                if (!url.includes('linkedin.com')) {
                    return 'Please enter a valid LinkedIn URL';
                }
                break;
            case 'instagram':
                if (!url.includes('instagram.com')) {
                    return 'Please enter a valid Instagram URL';
                }
                break;
            case 'twitter':
                if (!url.includes('twitter.com') && !url.includes('x.com')) {
                    return 'Please enter a valid Twitter/X URL';
                }
                break;
        }
        return '';
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));

        // Validate URLs
        if (name === 'instagram' || name === 'twitter' || name === 'linkedin') {
            const error = validateUrl(value, name as 'instagram' | 'twitter' | 'linkedin');
            setUrlErrors(prev => ({
                ...prev,
                [name]: error,
            }));
        }
    };

    const handlePhotoClick = () => {
        fileInputRef.current?.click();
    };

    const compressImage = (file: File, maxWidth: number = 800, maxHeight: number = 800, quality: number = 0.8): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions
                    if (width > height) {
                        if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = (width * maxHeight) / height;
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Could not get canvas context'));
                        return;
                    }

                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressedDataUrl);
                };
                img.onerror = reject;
                img.src = e.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Check if file is an image
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file');
                return;
            }

            // Check file size (max 5MB before compression)
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                alert('Image is too large. Please select an image smaller than 5MB.');
                return;
            }

            try {
                // Compress and resize the image
                const compressedDataUrl = await compressImage(file, 800, 800, 0.8);

                // Check if compressed image is still too large (max 2MB base64)
                if (compressedDataUrl.length > 2 * 1024 * 1024) {
                    // Try with lower quality
                    const smallerDataUrl = await compressImage(file, 600, 600, 0.6);
                    setFormData(prev => ({
                        ...prev,
                        profile_picture: smallerDataUrl,
                    }));
                } else {
                    setFormData(prev => ({
                        ...prev,
                        profile_picture: compressedDataUrl,
                    }));
                }
            } catch (error) {
                console.error('Error compressing image:', error);
                alert('Error processing image. Please try another image.');
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phoneNumber) return;

        // Validate all URLs before submitting
        const linkedinError = validateUrl(formData.linkedin, 'linkedin');
        const instagramError = formData.instagram ? validateUrl(formData.instagram, 'instagram') : '';
        const twitterError = formData.twitter ? validateUrl(formData.twitter, 'twitter') : '';

        setUrlErrors({
            linkedin: linkedinError,
            instagram: instagramError,
            twitter: twitterError,
        });

        if (linkedinError || instagramError || twitterError) {
            return; // Don't submit if there are validation errors
        }

        try {
            const response = await fetch(`/api/profile/${phoneNumber}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    number: formData.number || phoneNumber,
                    age: formData.age,
                    location: formData.location,
                    bio: formData.bio,
                    profile_picture: formData.profile_picture,
                    instagram: formData.instagram,
                    twitter: formData.twitter,
                    linkedin: formData.linkedin,
                }),
            });

            if (!response.ok) throw new Error('Failed to update profile');

            const updatedUser = await response.json();

            // Navigate back to profile page
            if (updatedUser.number !== phoneNumber) {
                navigate(`/profile/${updatedUser.number}`);
            } else {
                navigate(`/profile/${phoneNumber}`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update profile');
        }
    };

    const calculateCompletion = () => {
        const fields = ['first_name', 'last_name', 'number', 'bio', 'profile_picture', 'location', 'linkedin'];
        const completed = fields.filter(field => {
            const value = formData[field as keyof typeof formData];
            return value && value.toString().trim() !== '';
        }).length;
        return Math.round((completed / fields.length) * 100);
    };

    if (loading) {
        return (
            <div className="user-list__loading">
                <div className="spinner"></div>
                <p>Loading profile...</p>
            </div>
        );
    }

    if (error || !user) {
        return (
            <div className="user-list__error">
                <p>Error: {error || 'Profile not found'}</p>
                <button onClick={() => navigate('/')}>Go Home</button>
            </div>
        );
    }

    const completion = calculateCompletion();

    return (
        <div className="app">
            {!isSidebarOpen && (
                <button
                    className="edit-profile__menu-btn"
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
            <div className="edit-profile-page">

                <div className="edit-profile__header">
                    <h1>Edit Profile</h1>
                    <div className="edit-profile__photo-section" onClick={handlePhotoClick}>
                        {formData.profile_picture ? (
                            <img
                                src={formData.profile_picture}
                                alt="Profile"
                                className="edit-profile__photo-preview"
                            />
                        ) : (
                            <div className="edit-profile__photo-icon">🌿</div>
                        )}
                        <div className="edit-profile__photo-label">Profile</div>
                        <div className="edit-profile__photo-hint">Tap to change photo</div>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                </div>

                <form className="edit-profile__form" onSubmit={handleSubmit}>
                    <div className="edit-profile__field">
                        <label>NAME</label>
                        <div className="edit-profile__input-wrapper">
                            <input
                                type="text"
                                value={`${formData.first_name} ${formData.last_name}`.trim() || ''}
                                onChange={(e) => {
                                    const names = e.target.value.split(' ');
                                    setFormData(prev => ({
                                        ...prev,
                                        first_name: names[0] || '',
                                        last_name: names.slice(1).join(' ') || '',
                                    }));
                                }}
                                placeholder="Full Name"
                                className="edit-profile__input"
                            />
                            <span className="edit-profile__info-icon">ⓘ</span>
                        </div>
                    </div>

                    <div className="edit-profile__field">
                        <label>AGE</label>
                        <div className="edit-profile__input-wrapper">
                            <input
                                type="number"
                                name="age"
                                value={formData.age}
                                onChange={handleChange}
                                placeholder="Age"
                                min="1"
                                max="150"
                                className="edit-profile__input edit-profile__input--age"
                            />
                            <span className="edit-profile__dropdown-icon">▼</span>
                        </div>
                    </div>

                    <div className="edit-profile__field">
                        <label>LOCATION</label>
                        <input
                            type="text"
                            name="location"
                            value={formData.location}
                            onChange={handleChange}
                            placeholder="Location"
                            className="edit-profile__input"
                        />
                    </div>

                    <div className="edit-profile__field">
                        <label>BIO</label>
                        <div className="edit-profile__textarea-wrapper">
                            <textarea
                                name="bio"
                                value={formData.bio || "We've started your bio, feel free to update it!"}
                                onChange={handleChange}
                                className="edit-profile__textarea"
                                rows={4}
                            />
                            <span className="edit-profile__char-count">
                                {formData.bio ? formData.bio.length : 0}
                            </span>
                        </div>
                    </div>

                    <div className="edit-profile__field">
                        <label>SOCIALS</label>
                        <div className="edit-profile__socials">
                            <div className="edit-profile__social-field">
                                <label className="edit-profile__social-label">
                                    LinkedIn URL <span className="edit-profile__required">(Required)</span>
                                </label>
                                <div className="edit-profile__input-wrapper">
                                    <input
                                        type="url"
                                        name="linkedin"
                                        value={formData.linkedin}
                                        onChange={handleChange}
                                        placeholder="LinkedIn URL"
                                        className={`edit-profile__input ${urlErrors.linkedin ? 'edit-profile__input--error' : ''}`}
                                    />
                                    {formData.linkedin && !urlErrors.linkedin && (
                                        <span className="edit-profile__check-icon">✓</span>
                                    )}
                                </div>
                                {urlErrors.linkedin && (
                                    <span className="edit-profile__error-message">{urlErrors.linkedin}</span>
                                )}
                            </div>

                            <div className="edit-profile__social-field">
                                <label className="edit-profile__social-label">Instagram URL</label>
                                <input
                                    type="url"
                                    name="instagram"
                                    value={formData.instagram}
                                    onChange={handleChange}
                                    placeholder="Instagram URL"
                                    className={`edit-profile__input ${urlErrors.instagram ? 'edit-profile__input--error' : ''}`}
                                />
                                {urlErrors.instagram && (
                                    <span className="edit-profile__error-message">{urlErrors.instagram}</span>
                                )}
                            </div>

                            <div className="edit-profile__social-field">
                                <label className="edit-profile__social-label">X (Twitter) URL</label>
                                <input
                                    type="url"
                                    name="twitter"
                                    value={formData.twitter}
                                    onChange={handleChange}
                                    placeholder="X (Twitter) URL"
                                    className={`edit-profile__input ${urlErrors.twitter ? 'edit-profile__input--error' : ''}`}
                                />
                                {urlErrors.twitter && (
                                    <span className="edit-profile__error-message">{urlErrors.twitter}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="edit-profile__footer">
                        <div className="edit-profile__footer-left">
                            <div className="edit-profile__footer-title">Complete your profile</div>
                            <div className="edit-profile__footer-subtitle">{completion}% complete</div>
                        </div>
                        <button type="submit" className="edit-profile__save-btn">
                            Save Changes
                        </button>
                    </div>
                </form>

                <div className="edit-profile__delete-section">
                    <button
                        type="button"
                        className="edit-profile__delete-btn"
                        onClick={async () => {
                            if (!phoneNumber) return;

                            const confirmed = window.confirm(
                                'Are you sure you want to delete your account? This action cannot be undone and will delete all your data, messages, and connections.'
                            );

                            if (!confirmed) return;

                            try {
                                const response = await fetch(`/api/profile/${phoneNumber}`, {
                                    method: 'DELETE',
                                });

                                if (!response.ok) {
                                    const errorData = await response.json();
                                    throw new Error(errorData.error || 'Failed to delete account');
                                }

                                // Navigate to home page after successful deletion
                                navigate('/');
                            } catch (err) {
                                setError(err instanceof Error ? err.message : 'Failed to delete account');
                            }
                        }}
                    >
                        Delete Account
                    </button>
                </div>
            </div>
        </div>
    );
}
