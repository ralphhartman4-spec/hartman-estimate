import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // Vercel provides raw body
    const rawBody = await new Response(req.body).arrayBuffer();
    const body = Buffer.from(rawBody);

    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('PAYMENT SUCCESS:', session.metadata.app_invoice_id, session.amount_total / 100);
  }

  res.json({ received: true });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
