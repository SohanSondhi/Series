import { pgTable, serial, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    number: varchar('number', { length: 20 }).notNull().unique(),
    location: varchar('location', { length: 200 }),
    instagram: varchar('instagram', { length: 100 }),
    twitter: varchar('twitter', { length: 100 }),
    linkedin: varchar('linkedin', { length: 200 }),
    profilePicture: text('profile_picture'),
    bio: text('bio').default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    numberIdx: index('idx_users_number').on(table.number),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

