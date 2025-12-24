import { createClient } from 'redis';

const PUSH_TOKEN_KEY = 'expo-push-token';

export async function POST(request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return new Response(JSON.stringify({ error: 'No token provided' }), { status: 400 });
    }

    const client = createClient({
      url: process.env.REDIS_URL,
    });

    client.on('error', (err) => console.error('Redis Client Error', err));

    await client.connect();
    await client.set(PUSH_TOKEN_KEY, token);
    await client.disconnect();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Save push token error:', error);
    return new Response(JSON.stringify({ error: 'Failed to save token' }), { status: 500 });
  }
}

// Optional: GET to retrieve token for debugging
export async function GET() {
  try {
    const client = createClient({
      url: process.env.REDIS_URL,
    });

    await client.connect();
    const token = await client.get(PUSH_TOKEN_KEY);
    await client.disconnect();

    return new Response(JSON.stringify({ token }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ token: null }), { status: 500 });
  }
}
