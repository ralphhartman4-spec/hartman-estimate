import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { amount, invoiceId, customerName, customerEmail, connectedAccountId } = req.body;

    if (!amount || !invoiceId || !connectedAccountId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const amountInCents = amount

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
      success_url: 'https://hartman-estimate.vercel.app/success',
      cancel_url: 'https://hartman-estimate.vercel.app/cancel',
      metadata: {
        invoiceId: invoiceId,
      },
      payment_intent_data: {
        transfer_data: {
          destination: connectedAccountId,
        },
        application_fee_amount: Math.round(amountInCents * 0.01),
      },
      customer_email: customerEmail || undefined,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Create checkout error:', err);
    res.status(500).json({ error: err.message });
  }
}
