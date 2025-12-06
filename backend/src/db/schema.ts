import { pgTable, serial, varchar, text, timestamp, index, integer, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    number: varchar('number', { length: 20 }).notNull().unique(),
    age: integer('age'),
    location: varchar('location', { length: 200 }),
    instagram: varchar('instagram', { length: 100 }),
    twitter: varchar('twitter', { length: 100 }),
    linkedin: varchar('linkedin', { length: 200 }),
    profilePicture: text('profile_picture'),
    bio: text('bio').default(''),
    weeklyRecap: text('weekly_recap'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    numberIdx: index('idx_users_number').on(table.number),
}));

// Connections table for many-to-many relationship
export const connections = pgTable('connections', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    connectedUserId: integer('connected_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    userConnectionIdx: index('idx_user_connection').on(table.userId, table.connectedUserId),
    // Ensure unique connections (user can't connect to same person twice)
    uniqueConnection: unique('unique_user_connection').on(table.userId, table.connectedUserId),
}));

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
    connections: many(connections),
}));

export const connectionsRelations = relations(connections, ({ one }) => ({
    user: one(users, {
        fields: [connections.userId],
        references: [users.id],
    }),
    connectedUser: one(users, {
        fields: [connections.connectedUserId],
        references: [users.id],
    }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;

