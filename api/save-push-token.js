import { createClient } from 'redis';

const TOKENS_LIST = 'all_push_tokens'; // List to hold all tokens

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
    await client.rPush(TOKENS_LIST, token); // Add to list
    await client.disconnect();
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Save push token error:', error);
    return new Response(JSON.stringify({ error: 'Failed to save token' }), { status: 500 });
  }
}

export async function GET() {
  try {
    const client = getRedisClient();
    await client.connect();
    const count = await client.lLen(TOKENS_LIST); // Count tokens
    await client.disconnect();
    return new Response(JSON.stringify({ totalTokens: count }), { status: 200 });
  } catch (error) {
    console.error('Get tokens error:', error);
    return new Response(JSON.stringify({ totalTokens: 0 }), { status: 500 });
  }
}
