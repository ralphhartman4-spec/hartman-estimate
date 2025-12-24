import { createClient } from 'redis';

const DOCUMENTS_KEY = 'documents:all';

const client = createClient({
  url: process.env.REDIS_URL,
});

// Connect on module load (works in serverless with reuse)
client.on('error', (err) => console.error('Redis Client Error', err));

// Ensure connection (lazy connect)
if (!client.isOpen) {
  await client.connect();
}

export async function GET() {
  try {
    const documents = await client.get(DOCUMENTS_KEY);
    const parsed = documents ? JSON.parse(documents) : [];
    return new Response(JSON.stringify({ documents: Array.isArray(parsed) ? parsed : [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Redis GET error:', error);
    return new Response(JSON.stringify({ documents: [] }), { status: 500 });
  }
}

export async function POST(request) {
  try {
    const documents = await request.json();

    if (!Array.isArray(documents)) {
      return new Response(JSON.stringify({ error: 'Expected array of documents' }), { status: 400 });
    }

    await client.set(DOCUMENTS_KEY, JSON.stringify(documents));

    return new Response(JSON.stringify(documents), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Redis POST error:', error);
    return new Response(JSON.stringify({ error: 'Failed to save' }), { status: 500 });
  }
}
