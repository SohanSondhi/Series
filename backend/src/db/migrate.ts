import { db } from './index.js';
import { sql } from 'drizzle-orm';

/**
 * Run Drizzle migrations programmatically
 * This is called from the startup script
 */
export async function runMigrations() {
    try {
        // Import and execute migrations if using migration files
        // For now, we'll use drizzle-kit push via the script
        // This function can be extended to run migration files programmatically
        console.log('✅ Migrations handled by drizzle-kit push');
    } catch (error) {
        console.error('❌ Error running migrations:', error);
        throw error;
    }
}

