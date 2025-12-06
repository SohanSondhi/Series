import { db } from './index.js';
import { users, connections, messages, wrappedCache } from './schema.js';
import { eq } from 'drizzle-orm';

/**
 * Seed the database with test data for development
 */
async function seed() {
    console.log('🌱 Starting database seed...');

    try {
        // Clear existing data (in reverse order of dependencies)
        console.log('🧹 Clearing existing data...');
        await db.delete(wrappedCache);
        await db.delete(messages);
        await db.delete(connections);
        await db.delete(users);

        // Create test users
        console.log('👥 Creating test users...');
        
        // Main user (use a test phone number - replace with your actual number when testing)
        const [mainUser] = await db.insert(users).values({
            firstName: 'Sabrina',
            lastName: 'Do',
            number: '+17146549691', // Replace with your actual phone number for testing
            age: 25,
            location: 'New York, NY',
            bio: 'Building cool stuff and connecting with people!',
            weeklyRecap: 'Great week working on the Series hackathon project.',
        }).returning();

        // Connection 1 - Top connection (lots of messages)
        const [connection1] = await db.insert(users).values({
            firstName: 'Sohan',
            lastName: 'Sondhi',
            number: '+19082008172',
            age: 20,
            location: 'San Francisco, CA',
            bio: 'Tech enthusiast and startup founder.',
            weeklyRecap: 'Participating in Series hackathon.',
        }).returning();

        // Connection 2 - Second top connection
        const [connection2] = await db.insert(users).values({
            firstName: 'Alex',
            lastName: 'Rivera',
            number: '+2222222222',
            age: 28,
            location: 'Austin, TX',
            bio: 'Software engineer and open source contributor.',
            weeklyRecap: 'Got promoted to Staff Engineer and shipped a major feature to production.',
        }).returning();

        // Connection 3 - Old connection (haven't talked to in a while)
        const [connection3] = await db.insert(users).values({
            firstName: 'Maya',
            lastName: 'Patel',
            number: '+3333333333',
            age: 27,
            location: 'Miami, FL',
            bio: 'Travel photographer and content creator.',
            weeklyRecap: 'Just returned from Tokyo and started planning a photography exhibition.',
        }).returning();

        // Connection 4 - Another connection
        const [connection4] = await db.insert(users).values({
            firstName: 'Ace',
            lastName: 'Gaddi',
            number: '+4444444444',
            age: 22,
            location: 'New York, NY',
            twitter: 'https://twitter.com/acegotchuu',
            bio: 'Creator and builder. Always working on something new.',
            weeklyRecap: 'Building some crazy new projects and connecting with amazing people this week.',
        }).returning();

        console.log('✅ Created users:', { mainUser: mainUser.id, connection1: connection1.id, connection2: connection2.id, connection3: connection3.id, connection4: connection4.id });

        // Create connections (bidirectional)
        console.log('🔗 Creating connections...');
        await db.insert(connections).values([
            { userId: mainUser.id, connectedUserId: connection1.id },
            { userId: connection1.id, connectedUserId: mainUser.id },
            { userId: mainUser.id, connectedUserId: connection2.id },
            { userId: connection2.id, connectedUserId: mainUser.id },
            { userId: mainUser.id, connectedUserId: connection3.id },
            { userId: connection3.id, connectedUserId: mainUser.id },
            { userId: mainUser.id, connectedUserId: connection4.id },
            { userId: connection4.id, connectedUserId: mainUser.id },
        ]);

        console.log('✅ Created connections');

        // Create messages (to establish top connections vs old connections)
        console.log('💬 Creating messages...');
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Many messages with connection1 (top connection)
        const messagesWithConnection1 = [];
        for (let i = 0; i < 50; i++) {
            const timestamp = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
            messagesWithConnection1.push({
                userId: mainUser.id,
                messageText: `Message ${i + 1} to Sarah`,
                timestamp,
                messageRecipients: [connection1.number],
            });
        }
        await db.insert(messages).values(messagesWithConnection1);

        // Many messages with connection2 (second top connection)
        const messagesWithConnection2 = [];
        for (let i = 0; i < 35; i++) {
            const timestamp = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
            messagesWithConnection2.push({
                userId: mainUser.id,
                messageText: `Message ${i + 1} to Mike`,
                timestamp,
                messageRecipients: [connection2.number],
            });
        }
        await db.insert(messages).values(messagesWithConnection2);

        // Few messages with connection3 (Maya - some recent messages)
        const messagesWithConnection3 = [];
        for (let i = 0; i < 15; i++) {
            const timestamp = new Date(now.getTime() - Math.random() * 14 * 24 * 60 * 60 * 1000);
            messagesWithConnection3.push({
                userId: mainUser.id,
                messageText: `Message ${i + 1} to Maya`,
                timestamp,
                messageRecipients: [connection3.number],
            });
        }
        await db.insert(messages).values(messagesWithConnection3);

        // Few messages with connection4 (Ace - old connection, last message was a month ago)
        await db.insert(messages).values([
            {
                userId: mainUser.id,
                messageText: 'Hey Ace! Long time no talk!',
                timestamp: oneMonthAgo,
                messageRecipients: [connection4.number],
            },
            {
                userId: mainUser.id,
                messageText: 'We should catch up soon!',
                timestamp: new Date(oneMonthAgo.getTime() + 1000),
                messageRecipients: [connection4.number],
            },
        ]);

        console.log('✅ Created messages');

        // Create wrapped cache data with Twitter recaps
        console.log('📦 Creating wrapped cache data...');

        const createWrappedCacheData = (user: any, weeklyRecap: string) => ({
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.number,
            },
            statistics: {
                totalMessages: 100,
                messagesSent: 60,
                messagesReceived: 40,
                connectionCount: 10,
                averageMessageLength: 45,
            },
            twitterWrapped: {
                user: {
                    username: user.twitter?.split('/').pop() || 'unknown',
                    name: `${user.firstName} ${user.lastName}`,
                    profileImageUrl: null,
                    verified: false,
                },
                weeklyRecap: weeklyRecap,
                error: null,
            },
        });

        await db.insert(wrappedCache).values([
            {
                userId: connection1.id,
                data: createWrappedCacheData(connection1, connection1.weeklyRecap!),
                lastUpdated: now,
            },
            {
                userId: connection2.id,
                data: createWrappedCacheData(connection2, connection2.weeklyRecap!),
                lastUpdated: now,
            },
            {
                userId: connection3.id,
                data: createWrappedCacheData(connection3, connection3.weeklyRecap!),
                lastUpdated: now,
            },
            {
                userId: connection4.id,
                data: createWrappedCacheData(connection4, connection4.weeklyRecap!),
                lastUpdated: now,
            },
        ]);

        console.log('✅ Created wrapped cache data');

        console.log('\n🎉 Database seeded successfully!');
        console.log('\n📋 Summary:');
        console.log(`   Main user phone: ${mainUser.number}`);
        console.log(`   Connection 1 (Sarah - top): ${connection1.number}`);
        console.log(`   Connection 2 (Alex - top): ${connection2.number}`);
        console.log(`   Connection 3 (Maya - old): ${connection3.number}`);
        console.log(`   Connection 4 (Ace): ${connection4.number}`);
        console.log('\n💡 To test, send a message with "wrapped" or "summary" from the main user phone number.');

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        throw error;
    }
}

// Run the seed
seed()
    .then(() => {
        console.log('✅ Seed completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    });
