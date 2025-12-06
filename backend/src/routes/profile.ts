import { Router } from 'express';
import { db } from '../db/index.js';
import { users, connections } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const router = Router();

// Helper function to transform user to frontend format
const transformUser = (user: typeof users.$inferSelect) => ({
    id: user.id,
    first_name: user.firstName,
    last_name: user.lastName,
    number: user.number,
    age: user.age,
    location: user.location,
    instagram: user.instagram,
    twitter: user.twitter,
    linkedin: user.linkedin,
    profile_picture: user.profilePicture,
    bio: user.bio,
    weekly_recap: user.weeklyRecap,
    created_at: user.createdAt?.toISOString(),
    updated_at: user.updatedAt?.toISOString(),
});

// POST /api/profile - Create a new profile
router.post('/', async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            number,
            age,
            location,
            instagram,
            twitter,
            linkedin,
            profile_picture,
            bio,
            weekly_recap,
        } = req.body;

        // Validate required fields
        if (!first_name || !last_name || !number) {
            return res.status(400).json({
                error: 'First name, last name, and phone number are required',
            });
        }

        // Check if phone number already exists
        const [existingUser] = await db
            .select()
            .from(users)
            .where(eq(users.number, number));

        if (existingUser) {
            return res.status(409).json({ error: 'Phone number already in use' });
        }

        // Create new user
        const [newUser] = await db
            .insert(users)
            .values({
                firstName: first_name,
                lastName: last_name,
                number,
                age: age ? (typeof age === 'string' ? parseInt(age) : age) : null,
                location: location || null,
                instagram: instagram || null,
                twitter: twitter || null,
                linkedin: linkedin || null,
                profilePicture: profile_picture || null,
                bio: bio || '',
                weeklyRecap: weekly_recap || null,
            })
            .returning();

        res.status(201).json(transformUser(newUser));
    } catch (error: any) {
        console.error('Error creating profile:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Phone number already in use' });
        }
        res.status(500).json({ error: 'Failed to create profile' });
    }
});

// GET /api/profile/:phoneNumber - Get profile by phone number
router.get('/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;

        // Find user by phone number
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.number, phoneNumber));

        if (!user) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Get user's connections with their weekly recaps
        const userConnections = await db
            .select({
                id: users.id,
                firstName: users.firstName,
                lastName: users.lastName,
                number: users.number,
                age: users.age,
                location: users.location,
                instagram: users.instagram,
                twitter: users.twitter,
                linkedin: users.linkedin,
                profilePicture: users.profilePicture,
                bio: users.bio,
                weeklyRecap: users.weeklyRecap,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
            })
            .from(connections)
            .innerJoin(users, eq(connections.connectedUserId, users.id))
            .where(eq(connections.userId, user.id));

        // Transform connections
        const transformedConnections = userConnections.map(transformUser);

        // Return user with connections
        res.json({
            ...transformUser(user),
            connections: transformedConnections,
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// PUT /api/profile/:phoneNumber - Update profile by phone number
router.put('/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const {
            first_name,
            last_name,
            number,
            age,
            location,
            instagram,
            twitter,
            linkedin,
            profile_picture,
            bio,
            weekly_recap,
        } = req.body;

        // Validate required fields
        if (!first_name || !last_name) {
            return res.status(400).json({
                error: 'First name and last name are required',
            });
        }

        // Find user by phone number
        const [existingUser] = await db
            .select()
            .from(users)
            .where(eq(users.number, phoneNumber));

        if (!existingUser) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // If number is being changed, check if new number already exists
        if (number && number !== phoneNumber) {
            const [numberExists] = await db
                .select()
                .from(users)
                .where(eq(users.number, number));

            if (numberExists && numberExists.id !== existingUser.id) {
                return res.status(409).json({ error: 'Phone number already in use' });
            }
        }

        // Update user
        const [updatedUser] = await db
            .update(users)
            .set({
                firstName: first_name,
                lastName: last_name,
                number: number || phoneNumber, // Use existing number if not provided
                age: age !== undefined && age !== null && age !== '' ? (typeof age === 'string' ? parseInt(age) : Number(age)) : null,
                location: location || null,
                instagram: instagram || null,
                twitter: twitter || null,
                linkedin: linkedin || null,
                profilePicture: profile_picture || null,
                bio: bio || '',
                weeklyRecap: weekly_recap || null,
            })
            .where(eq(users.number, phoneNumber))
            .returning();

        if (!updatedUser) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        res.json(transformUser(updatedUser));
    } catch (error: any) {
        console.error('Error updating profile:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Phone number already in use' });
        }
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// POST /api/profile/:phoneNumber/connections - Add a connection
router.post('/:phoneNumber/connections', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const { connectedPhoneNumber } = req.body;

        if (!connectedPhoneNumber) {
            return res.status(400).json({ error: 'Connected phone number is required' });
        }

        // Find both users
        const [user] = await db.select().from(users).where(eq(users.number, phoneNumber));
        const [connectedUser] = await db
            .select()
            .from(users)
            .where(eq(users.number, connectedPhoneNumber));

        if (!user || !connectedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.id === connectedUser.id) {
            return res.status(400).json({ error: 'Cannot connect to yourself' });
        }

        // Check if connection already exists
        const [existingConnection] = await db
            .select()
            .from(connections)
            .where(
                and(
                    eq(connections.userId, user.id),
                    eq(connections.connectedUserId, connectedUser.id)
                )
            );

        if (existingConnection) {
            return res.status(409).json({ error: 'Connection already exists' });
        }

        // Create connection
        const [newConnection] = await db
            .insert(connections)
            .values({
                userId: user.id,
                connectedUserId: connectedUser.id,
            })
            .returning();

        res.status(201).json({
            message: 'Connection added successfully',
            connection: newConnection,
        });
    } catch (error: any) {
        console.error('Error adding connection:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Connection already exists' });
        }
        res.status(500).json({ error: 'Failed to add connection' });
    }
});

// DELETE /api/profile/:phoneNumber/connections/:connectedPhoneNumber - Remove a connection
router.delete('/:phoneNumber/connections/:connectedPhoneNumber', async (req, res) => {
    try {
        const { phoneNumber, connectedPhoneNumber } = req.params;

        // Find both users
        const [user] = await db.select().from(users).where(eq(users.number, phoneNumber));
        const [connectedUser] = await db
            .select()
            .from(users)
            .where(eq(users.number, connectedPhoneNumber));

        if (!user || !connectedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete connection
        const [deletedConnection] = await db
            .delete(connections)
            .where(
                and(
                    eq(connections.userId, user.id),
                    eq(connections.connectedUserId, connectedUser.id)
                )
            )
            .returning();

        if (!deletedConnection) {
            return res.status(404).json({ error: 'Connection not found' });
        }

        res.json({ message: 'Connection removed successfully' });
    } catch (error) {
        console.error('Error removing connection:', error);
        res.status(500).json({ error: 'Failed to remove connection' });
    }
});

// DELETE /api/profile/:phoneNumber - Delete user account by phone number
router.delete('/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;

        // Normalize phone number (remove non-digits)
        const normalizedPhone = phoneNumber.replace(/\D/g, '');

        // Find user by phone number
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.number, normalizedPhone));

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete user (cascade will handle connections and messages)
        const [deletedUser] = await db
            .delete(users)
            .where(eq(users.number, normalizedPhone))
            .returning();

        if (!deletedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            message: 'Account deleted successfully',
            user: transformUser(deletedUser),
        });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

export default router;

