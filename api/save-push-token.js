// api/save-push-token.js (or .ts if using TypeScript)

import { createClient } from 'redis';

const PUSH_TOKENS_SET = 'expo_push_tokens'; // Name of the Redis set

const getRedisClient = () => {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL environment variable is not set');
  }
  const client = createClient({
    url: process.env.REDIS_URL,
  });
  client.on('error', (err) => console.error('Redis Client Error:', err));
  return client;
};

export async function POST(request) {
  try {
    const { token } = await request.json();

    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid or missing token' }), { status: 400 });
    }

    const client = getRedisClient();
    await client.connect();

    // Add token to set — SADD returns number of new members added (1 if new, 0 if already exists)
    const added = await client.sAdd(PUSH_TOKENS_SET, token);

    await client.disconnect();

    console.log(`Token ${added ? 'saved (new)' : 'already existed'}: ${token.substring(0, 20)}...`);

    return new Response(JSON.stringify({ success: true, added: !!added }), { status: 200 });
  } catch (error) {
    console.error('Save push token error:', error);
    return new Response(JSON.stringify({ error: 'Failed to save token' }), { status: 500 });
  }
}

// Optional: Keep GET for debugging (shows count + sample)
export async function GET() {
  try {
    const client = getRedisClient();
    await client.connect();

    const count = await client.sCard(PUSH_TOKENS_SET); // Number of tokens
    const sample = await client.sRandMember(PUSH_TOKENS_SET, 5); // Random 5 for preview

    await client.disconnect();

    return new Response(JSON.stringify({ 
      totalTokens: count,
      sampleTokens: sample 
    }), { status: 200 });
  } catch (error) {
    console.error('Get tokens error:', error);
    return new Response(JSON.stringify({ totalTokens: 0 }), { status: 500 });
  }
}
