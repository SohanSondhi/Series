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

// Messages table for storing Kafka message events
export const messages = pgTable('messages', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    messageText: text('message_text').notNull(),
    direction: varchar('direction', { length: 20 }).notNull(), // 'inbound' or 'outbound'
    timestamp: timestamp('timestamp').notNull(),
    counterpartyPhone: varchar('counterparty_phone', { length: 20 }), // DEPRECATED: Use message_counterparties table instead
    chatId: varchar('chat_id', { length: 50 }), // Chat ID from Series API
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    userIdIdx: index('idx_messages_user_id').on(table.userId),
    timestampIdx: index('idx_messages_timestamp').on(table.timestamp),
    counterpartyIdx: index('idx_messages_counterparty').on(table.counterpartyPhone),
    chatIdIdx: index('idx_messages_chat_id').on(table.chatId),
}));

// Message counterparties table for storing multiple counterparties per message (group chats)
export const messageCounterparties = pgTable('message_counterparties', {
    id: serial('id').primaryKey(),
    messageId: integer('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
    counterpartyPhone: varchar('counterparty_phone', { length: 20 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    messageIdIdx: index('idx_message_counterparties_message_id').on(table.messageId),
    counterpartyIdx: index('idx_message_counterparties_counterparty').on(table.counterpartyPhone),
    messageCounterpartyIdx: index('idx_message_counterparties_message_counterparty').on(table.messageId, table.counterpartyPhone),
}));

// Define relations
export const messagesRelations = relations(messages, ({ one, many }) => ({
    user: one(users, {
        fields: [messages.userId],
        references: [users.id],
    }),
    counterparties: many(messageCounterparties),
}));

export const messageCounterpartiesRelations = relations(messageCounterparties, ({ one }) => ({
    message: one(messages, {
        fields: [messageCounterparties.messageId],
        references: [messages.id],
    }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type MessageCounterparty = typeof messageCounterparties.$inferSelect;
export type NewMessageCounterparty = typeof messageCounterparties.$inferInsert;

