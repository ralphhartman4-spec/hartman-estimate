import { Redis } from '@upstash/redis'; // If you add the package, or use Vercel's if available

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const TOKENS_LIST = 'all_push_tokens';

export async function POST(request) {
  try {
    const { token } = await request.json();
    if (!token) return new Response('Bad token', { status: 400 });

    await redis.rpush(TOKENS_LIST, token); // Or sadd for unique

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response('Error', { status: 500 });
  }
}

export async function GET() {
  try {
    const count = await redis.llen(TOKENS_LIST);
    return new Response(JSON.stringify({ totalTokens: count }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ totalTokens: 0 }), { status: 500 });
  }
}
