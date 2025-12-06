import { db } from './index.js';
import { sql } from 'drizzle-orm';

/**
 * Initialize database with triggers and functions.
 * Note: The schema itself is managed by Drizzle Kit via `npm run db:migrate`
 * This function only sets up the trigger for auto-updating updated_at
 */
export async function initializeDatabase() {
    try {
        // Create function to update updated_at timestamp
        await db.execute(sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

        // Create trigger to automatically update updated_at
        await db.execute(sql`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

        console.log('✅ Database triggers initialized successfully');
    } catch (error) {
        // If table doesn't exist yet, that's okay - drizzle-kit push will create it
        if (error instanceof Error && error.message.includes('does not exist')) {
            console.log('ℹ️  Users table not found. Run `npm run db:migrate` to create it.');
            return;
        }
        console.error('❌ Error initializing database triggers:', error);
        throw error;
    }
}

