import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateUserData } from '../types/user';

export default function CreatePage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<CreateUserData>({
        first_name: '',
        last_name: '',
        number: '',
        age: undefined,
        location: '',
        instagram: '',
        twitter: '',
        linkedin: '',
        profile_picture: '',
        bio: '',
        weekly_recap: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create profile');
            }

            const data = await response.json();
            // Navigate to the newly created profile
            navigate(`/profile/${data.number}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-page">
            <div className="create-page__container">
                <div className="create-page__header">
                    <h1>Create New Profile</h1>
                    <button
                        className="create-page__back-btn"
                        onClick={() => navigate('/')}
                    >
                        ← Back
                    </button>
                </div>

                {error && (
                    <div className="create-page__error">
                        <p>{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="create-page__form">
                    <div className="create-page__form-group">
                        <label htmlFor="first_name">
                            First Name <span className="required">*</span>
                        </label>
                        <input
                            type="text"
                            id="first_name"
                            name="first_name"
                            value={formData.first_name}
                            onChange={handleChange}
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="create-page__form-group">
                        <label htmlFor="last_name">
                            Last Name <span className="required">*</span>
                        </label>
                        <input
                            type="text"
                            id="last_name"
                            name="last_name"
                            value={formData.last_name}
                            onChange={handleChange}
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="create-page__form-group">
                        <label htmlFor="number">
                            Phone Number <span className="required">*</span>
                        </label>
                        <input
                            type="tel"
                            id="number"
                            name="number"
                            value={formData.number}
                            onChange={handleChange}
                            required
                            disabled={loading}
                            placeholder="e.g., +1234567890"
                        />
                    </div>

                    <div className="create-page__form-group">
                        <label htmlFor="age">Age</label>
                        <input
                            type="number"
                            id="age"
                            name="age"
                            value={formData.age || ''}
                            onChange={(e) => {
                                const value = e.target.value;
                                setFormData(prev => ({
                                    ...prev,
                                    age: value ? parseInt(value) : undefined,
                                }));
                            }}
                            disabled={loading}
                            min="1"
                            max="150"
                            placeholder="e.g., 25"
                        />
                    </div>

                    <div className="create-page__form-group">
                        <label htmlFor="location">Location</label>
                        <input
                            type="text"
                            id="location"
                            name="location"
                            value={formData.location}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="e.g., New York, NY"
                        />
                    </div>

                    <div className="create-page__form-group">
                        <label htmlFor="profile_picture">Profile Picture URL</label>
                        <input
                            type="url"
                            id="profile_picture"
                            name="profile_picture"
                            value={formData.profile_picture}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="https://example.com/image.jpg"
                        />
                    </div>

                    <div className="create-page__form-group">
                        <label htmlFor="bio">Bio</label>
                        <textarea
                            id="bio"
                            name="bio"
                            value={formData.bio}
                            onChange={handleChange}
                            disabled={loading}
                            rows={4}
                            placeholder="Tell us about yourself..."
                        />
                    </div>

                    <div className="create-page__form-group">
                        <label htmlFor="instagram">Instagram</label>
                        <input
                            type="text"
                            id="instagram"
                            name="instagram"
                            value={formData.instagram}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="@username"
                        />
                    </div>

                    <div className="create-page__form-group">
                        <label htmlFor="twitter">Twitter</label>
                        <input
                            type="text"
                            id="twitter"
                            name="twitter"
                            value={formData.twitter}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="@username"
                        />
                    </div>

                    <div className="create-page__form-group">
                        <label htmlFor="linkedin">LinkedIn</label>
                        <input
                            type="text"
                            id="linkedin"
                            name="linkedin"
                            value={formData.linkedin}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="linkedin.com/in/username"
                        />
                    </div>

                    <div className="create-page__form-group">
                        <label htmlFor="weekly_recap">Weekly Recap</label>
                        <textarea
                            id="weekly_recap"
                            name="weekly_recap"
                            value={formData.weekly_recap}
                            onChange={handleChange}
                            disabled={loading}
                            rows={4}
                            placeholder="What have you been up to this week?"
                        />
                    </div>

                    <div className="create-page__form-actions">
                        <button
                            type="button"
                            className="create-page__cancel-btn"
                            onClick={() => navigate('/')}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="create-page__submit-btn"
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Create Profile'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
