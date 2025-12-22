import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    const {
      amount,
      invoiceId,
      customerName = 'Customer',
      customerEmail,
      connectedAccountId, // Contractor's account ID
    } = req.body;

    if (!amount || amount <= 0 || !invoiceId) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Invoice #${invoiceId}`,
              description: `Hartman Estimate - ${customerName}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      customer_email: customerEmail || undefined,
      success_url: 'https://hartman-estimate.vercel.app/success',
      cancel_url: 'https://hartman-estimate.vercel.app/cancel',
      metadata: { invoice_id: invoiceId },
      client_reference_id: invoiceId,
    };

    let session;

    if (connectedAccountId) {
      // DESTINATION CHARGE — contractor gets money, BareBones gets fee
      session = await stripe.checkout.sessions.create(
        {
          ...sessionParams,
          payment_intent_data: {
            application_fee_amount: Math.round(amount * 0.05), // 5% to BareBones
            transfer_data: {
              destination: connectedAccountId,
            },
          },
        },
        {
          stripeAccount: connectedAccountId, // THIS IS REQUIRED
        }
      );
    } else {
      session = await stripe.checkout.sessions.create(sessionParams);
    }

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
}
