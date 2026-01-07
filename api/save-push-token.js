import { createClient } from 'redis';

const TOKENS_LIST = 'all_push_tokens'; // Redis list key

const client = createClient({
  url: process.env.REDIS_URL,
});
client.on('error', (err) => console.error('Redis Error:', err));

export async function POST(request) {
  try {
    const { token } = await request.json();
    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 400 });
    }

    await client.connect();
    // Add token to the end of the list (duplicates OK for now, or use LPUSH with check if you want)
    await client.rPush(TOKENS_LIST, token);
    await client.disconnect();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Failed' }), { status: 500 });
  }
}

// For debugging — see how many tokens we have
export async function GET() {
  try {
    await client.connect();
    const count = await client.lLen(TOKENS_LIST);
    await client.disconnect();
    return new Response(JSON.stringify({ totalTokens: count }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ totalTokens: 0 }), { status: 500 });
  }
}
