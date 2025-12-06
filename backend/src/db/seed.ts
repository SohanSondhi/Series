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
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        // Realistic message templates for variety
        const sohanMessages = [
            'Hey! How\'s the hackathon going?',
            'That sounds awesome!',
            'Yeah totally agree',
            'Haha that\'s hilarious',
            'Working on the backend right now',
            'Did you see that new feature?',
            'Let\'s sync up later',
            'Thanks for the help!',
            'Just pushed the latest changes',
            'What do you think about this approach?',
            'That makes sense',
            'Cool, let me know when you\'re ready',
            'Same here!',
            'Just finished that task',
            'Can you review this?',
            'Sounds good to me',
            'Let\'s discuss this tomorrow',
            'Great work on that!',
            'I\'ll check it out',
            'Perfect timing',
        ];

        const alexMessages = [
            'Hey Alex!',
            'How\'s everything going?',
            'Congrats on the promotion!',
            'That\'s really impressive',
            'Would love to hear more about it',
            'Thanks for sharing',
            'Let\'s catch up soon',
            'Hope you\'re doing well',
        ];

        const mayaMessages = [
            'Hey Maya!',
            'How was Tokyo?',
            'The photos look amazing',
            'Would love to see the exhibition',
            'Hope you\'re doing well',
        ];

        // Many messages with connection1 (Sohan - top connection, most messages)
        const messagesWithConnection1 = [];
        const sohanMessageCount = 247; // Sohan has the most messages
        for (let i = 0; i < sohanMessageCount; i++) {
            // Spread messages over the past 2 weeks, with more recent activity
            const daysAgo = Math.random() < 0.7 ? Math.random() * 7 : 7 + Math.random() * 7;
            const hoursAgo = Math.random() * 24;
            const timestamp = new Date(now.getTime() - (daysAgo * 24 + hoursAgo) * 60 * 60 * 1000);
            const messageText = sohanMessages[Math.floor(Math.random() * sohanMessages.length)];
            messagesWithConnection1.push({
                userId: mainUser.id,
                messageText: messageText,
                timestamp,
                messageRecipients: [connection1.number],
            });
        }
        await db.insert(messages).values(messagesWithConnection1);

        // Many messages with connection2 (Alex - second top connection)
        const messagesWithConnection2 = [];
        const alexMessageCount = 89; // Less than Sohan
        for (let i = 0; i < alexMessageCount; i++) {
            const daysAgo = Math.random() < 0.6 ? Math.random() * 7 : 7 + Math.random() * 7;
            const hoursAgo = Math.random() * 24;
            const timestamp = new Date(now.getTime() - (daysAgo * 24 + hoursAgo) * 60 * 60 * 1000);
            const messageText = alexMessages[Math.floor(Math.random() * alexMessages.length)];
            messagesWithConnection2.push({
                userId: mainUser.id,
                messageText: messageText,
                timestamp,
                messageRecipients: [connection2.number],
            });
        }
        await db.insert(messages).values(messagesWithConnection2);

        // Few messages with connection3 (Maya - some recent messages)
        const messagesWithConnection3 = [];
        const mayaMessageCount = 23; // Much less than Sohan
        for (let i = 0; i < mayaMessageCount; i++) {
            const daysAgo = Math.random() * 21; // Spread over 3 weeks
            const hoursAgo = Math.random() * 24;
            const timestamp = new Date(now.getTime() - (daysAgo * 24 + hoursAgo) * 60 * 60 * 1000);
            const messageText = mayaMessages[Math.floor(Math.random() * mayaMessages.length)];
            messagesWithConnection3.push({
                userId: mainUser.id,
                messageText: messageText,
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

        const createWrappedCacheData = (user: any, weeklyRecap: string, messageCount: number) => ({
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.number,
            },
            statistics: {
                totalMessages: messageCount * 2, // Rough estimate: sent + received
                messagesSent: Math.floor(messageCount * 1.2), // Slightly more sent
                messagesReceived: Math.floor(messageCount * 0.8), // Slightly fewer received
                connectionCount: 4,
                averageMessageLength: Math.floor(35 + Math.random() * 20), // Random between 35-55
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
                data: createWrappedCacheData(connection1, connection1.weeklyRecap!, sohanMessageCount),
                lastUpdated: now,
            },
            {
                userId: connection2.id,
                data: createWrappedCacheData(connection2, connection2.weeklyRecap!, alexMessageCount),
                lastUpdated: now,
            },
            {
                userId: connection3.id,
                data: createWrappedCacheData(connection3, connection3.weeklyRecap!, mayaMessageCount),
                lastUpdated: now,
            },
            {
                userId: connection4.id,
                data: createWrappedCacheData(connection4, connection4.weeklyRecap!, 2),
                lastUpdated: now,
            },
        ]);

        console.log('✅ Created wrapped cache data');

        console.log('\n🎉 Database seeded successfully!');
        console.log('\n📋 Summary:');
        console.log(`   Main user phone: ${mainUser.number}`);
        console.log(`   Connection 1 (Sohan - top): ${connection1.number} - ${sohanMessageCount} messages`);
        console.log(`   Connection 2 (Alex - second): ${connection2.number} - ${alexMessageCount} messages`);
        console.log(`   Connection 3 (Maya - occasional): ${connection3.number} - ${mayaMessageCount} messages`);
        console.log(`   Connection 4 (Ace - old): ${connection4.number} - 2 messages`);
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
