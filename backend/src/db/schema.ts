import { pgTable, serial, varchar, text, timestamp, index, integer, unique, jsonb } from 'drizzle-orm/pg-core';
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

// Messages table for storing Kafka message events
export const messages = pgTable('messages', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    messageText: text('message_text').notNull(),
    timestamp: timestamp('timestamp').notNull(),
    chatId: varchar('chat_id', { length: 50 }), // Chat ID from Series API
    messageRecipients: text('message_recipients').array(), // Array of recipient phone numbers
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    userIdIdx: index('idx_messages_user_id').on(table.userId),
    timestampIdx: index('idx_messages_timestamp').on(table.timestamp),
    chatIdIdx: index('idx_messages_chat_id').on(table.chatId),
}));


// Define relations
export const messagesRelations = relations(messages, ({ one }) => ({
    user: one(users, {
        fields: [messages.userId],
        references: [users.id],
    }),
}));

// Wrapped cache table for storing calculated wrapped data
export const wrappedCache = pgTable('wrapped_cache', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
    data: jsonb('data').notNull(), // Store the full wrapped data as JSON
    lastUpdated: timestamp('last_updated').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    userIdIdx: index('idx_wrapped_cache_user_id').on(table.userId),
    lastUpdatedIdx: index('idx_wrapped_cache_last_updated').on(table.lastUpdated),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type WrappedCache = typeof wrappedCache.$inferSelect;
export type NewWrappedCache = typeof wrappedCache.$inferInsert;

