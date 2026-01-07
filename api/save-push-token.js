// api/save-push-token.js

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const PUSH_TOKENS_SET = 'expo_push_tokens';

export async function POST(request) {
  try {
    const { token } = await request.json();
    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 400 });
    }

    const added = await redis.sadd(PUSH_TOKENS_SET, token);
    console.log(`Token ${added ? 'added (new)' : 'duplicate'}`);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Save error:', error);
    return new Response(JSON.stringify({ error: 'Failed' }), { status: 500 });
  }
}

export async function GET() {
  try {
    const count = await redis.scard(PUSH_TOKENS_SET);
    const samples = await redis.srandmember(PUSH_TOKENS_SET, 5);

    return new Response(JSON.stringify({ totalTokens: count, sampleTokens: samples }), { status: 200 });
  } catch (error) {
    console.error('GET error:', error);
    return new Response(JSON.stringify({ totalTokens: 0 }), { status: 500 });
  }
}
