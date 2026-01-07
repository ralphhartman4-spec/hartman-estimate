// api/send-broadcast.js

import { Expo } from 'expo-server-sdk';
import { createClient } from 'redis';

const PUSH_TOKENS_SET = 'expo_push_tokens';
const expo = new Expo(); // Add { accessToken: '...' } if you enabled push security

const getRedisClient = () => {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL missing');
  const client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (err) => console.error('Redis Error:', err));
  return client;
};

export async function POST(request) {
  // Optional: Add simple auth (e.g., secret header) later

  try {
    const client = getRedisClient();
    await client.connect();

    const allTokens = await client.sMembers(PUSH_TOKENS_SET); // Get ALL tokens
    await client.disconnect();

    if (allTokens.length === 0) {
      return new Response(JSON.stringify({ error: 'No tokens stored' }), { status: 400 });
    }

    console.log(`Sending notification to ${allTokens.length} devices`);

    let messages = [];
    for (let token of allTokens) {
      if (!Expo.isExpoPushToken(token)) {
        console.warn(`Invalid token: ${token}`);
        continue;
      }

      messages.push({
        to: token,
        sound: 'default',
        title: 'Hartman Estimate Update 🎉',
        body: 'Pro is now more affordable – upgrade today!',
        data: { screen: 'Paywall' },
      });
    }

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (let chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Send chunk failed:', error);
      }
    }

    return new Response(JSON.stringify({
      sentTo: messages.length,
      tickets: tickets.length,
      message: 'Broadcast sent successfully!'
    }), { status: 200 });

  } catch (error) {
    console.error('Broadcast error:', error);
    return new Response(JSON.stringify({ error: 'Broadcast failed' }), { status: 500 });
  }
}
