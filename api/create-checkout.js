import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { amount, invoiceId, customerName, customerEmail } = req.body;

    if (!amount || !invoiceId) {
      return res.status(400).json({ error: 'Missing amount or invoiceId' });
    }

   

    if (amount < 0 || amount == 0) {
      return res.status(400).json({ error: 'Amount too small' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Invoice #${invoiceId}`,
              description: customerName ? `Payment for ${customerName}` : 'Invoice payment',
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://your-app.com/success?session_id={CHECKOUT_SESSION_ID}', // optional
      cancel_url: 'https://your-app.com/cancel', // optional
      metadata: {
        invoiceId: invoiceId, // ← CRITICAL for webhook
      },
      customer_email: customerEmail || undefined,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Create checkout error:', err);
    res.status(500).json({ error: err.message });
  }
}
