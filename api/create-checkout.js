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

    const amountInCents = Math.round(parseFloat(amount) * 100); // ← CONVERT DOLLARS TO CENTS

    if (amountInCents < 50) { // Stripe minimum is 50 cents
      return res.status(400).json({ error: 'Amount too small (minimum $0.50)' });
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
            unit_amount: amountInCents, // ← NOW IN CENTS
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `https://hartman-estimate.vercel.app/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://hartman-estimate.vercel.app/cancel`,
      metadata: {
        invoiceId: invoiceId, // ← Critical for webhook
      },
      customer_email: customerEmail || undefined,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Create checkout error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
