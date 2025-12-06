import { Router } from 'express';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// Get all users
router.get('/', async (req, res) => {
    try {
        const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));

        // Transform to match frontend expectations (snake_case)
        const transformedUsers = allUsers.map(user => ({
            id: user.id,
            first_name: user.firstName,
            last_name: user.lastName,
            number: user.number,
            location: user.location,
            instagram: user.instagram,
            twitter: user.twitter,
            linkedin: user.linkedin,
            profile_picture: user.profilePicture,
            bio: user.bio,
            created_at: user.createdAt?.toISOString(),
            updated_at: user.updatedAt?.toISOString(),
        }));

        res.json(transformedUsers);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get user by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);

        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const [user] = await db.select().from(users).where(eq(users.id, userId));

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Transform to match frontend expectations
        res.json({
            id: user.id,
            first_name: user.firstName,
            last_name: user.lastName,
            number: user.number,
            location: user.location,
            instagram: user.instagram,
            twitter: user.twitter,
            linkedin: user.linkedin,
            profile_picture: user.profilePicture,
            bio: user.bio,
            created_at: user.createdAt?.toISOString(),
            updated_at: user.updatedAt?.toISOString(),
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Create new user
router.post('/', async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            number,
            location,
            instagram,
            twitter,
            linkedin,
            profile_picture,
            bio,
        } = req.body;

        // Validate required fields
        if (!first_name || !last_name || !number) {
            return res.status(400).json({
                error: 'First name, last name, and number are required',
            });
        }

        const [newUser] = await db.insert(users).values({
            firstName: first_name,
            lastName: last_name,
            number,
            location: location || null,
            instagram: instagram || null,
            twitter: twitter || null,
            linkedin: linkedin || null,
            profilePicture: profile_picture || null,
            bio: bio || '',
        }).returning();

        // Transform to match frontend expectations
        res.status(201).json({
            id: newUser.id,
            first_name: newUser.firstName,
            last_name: newUser.lastName,
            number: newUser.number,
            location: newUser.location,
            instagram: newUser.instagram,
            twitter: newUser.twitter,
            linkedin: newUser.linkedin,
            profile_picture: newUser.profilePicture,
            bio: newUser.bio,
            created_at: newUser.createdAt?.toISOString(),
            updated_at: newUser.updatedAt?.toISOString(),
        });
    } catch (error: any) {
        console.error('Error creating user:', error);
        if (error.code === '23505') {
            // Unique violation
            return res.status(409).json({ error: 'User with this number already exists' });
        }
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Update user
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);

        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const {
            first_name,
            last_name,
            number,
            location,
            instagram,
            twitter,
            linkedin,
            profile_picture,
            bio,
        } = req.body;

        // Validate required fields
        if (!first_name || !last_name || !number) {
            return res.status(400).json({
                error: 'First name, last name, and number are required',
            });
        }

        const [updatedUser] = await db
            .update(users)
            .set({
                firstName: first_name,
                lastName: last_name,
                number,
                location: location || null,
                instagram: instagram || null,
                twitter: twitter || null,
                linkedin: linkedin || null,
                profilePicture: profile_picture || null,
                bio: bio || '',
            })
            .where(eq(users.id, userId))
            .returning();

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Transform to match frontend expectations
        res.json({
            id: updatedUser.id,
            first_name: updatedUser.firstName,
            last_name: updatedUser.lastName,
            number: updatedUser.number,
            location: updatedUser.location,
            instagram: updatedUser.instagram,
            twitter: updatedUser.twitter,
            linkedin: updatedUser.linkedin,
            profile_picture: updatedUser.profilePicture,
            bio: updatedUser.bio,
            created_at: updatedUser.createdAt?.toISOString(),
            updated_at: updatedUser.updatedAt?.toISOString(),
        });
    } catch (error: any) {
        console.error('Error updating user:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'User with this number already exists' });
        }
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);

        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const [deletedUser] = await db
            .delete(users)
            .where(eq(users.id, userId))
            .returning();

        if (!deletedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Transform to match frontend expectations
        res.json({
            message: 'User deleted successfully',
            user: {
                id: deletedUser.id,
                first_name: deletedUser.firstName,
                last_name: deletedUser.lastName,
                number: deletedUser.number,
                location: deletedUser.location,
                instagram: deletedUser.instagram,
                twitter: deletedUser.twitter,
                linkedin: deletedUser.linkedin,
                profile_picture: deletedUser.profilePicture,
                bio: deletedUser.bio,
                created_at: deletedUser.createdAt?.toISOString(),
                updated_at: deletedUser.updatedAt?.toISOString(),
            },
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;

