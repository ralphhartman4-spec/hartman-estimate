import { createClient } from 'redis';

const DOCUMENTS_KEY = 'documents:all';

export async function GET() {
  const client = createClient({
    url: process.env.REDIS_URL,
  });

  client.on('error', (err) => console.error('Redis Client Error', err));

  try {
    await client.connect();
    const documents = await client.get(DOCUMENTS_KEY);
    await client.disconnect();

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
  const client = createClient({
    url: process.env.REDIS_URL,
  });

  client.on('error', (err) => console.error('Redis Client Error', err));

  try {
    const documents = await request.json();

    if (!Array.isArray(documents)) {
      return new Response(JSON.stringify({ error: 'Expected array of documents' }), { status: 400 });
    }

    await client.connect();
    await client.set(DOCUMENTS_KEY, JSON.stringify(documents));
    await client.disconnect();

    return new Response(JSON.stringify(documents), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Redis POST error:', error);
    return new Response(JSON.stringify({ error: 'Failed to save' }), { status: 500 });
  }
}
