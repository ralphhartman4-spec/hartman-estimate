import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20', // Use latest stable
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      amount, // in cents (smallest currency unit)
      currency = 'usd',
      invoiceId,
      customerName = 'Customer',
      customerEmail,
      connectedAccountId,
    } = req.body;

    // === VALIDATION ===
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    if (!invoiceId) {
      return res.status(400).json({ error: 'Missing invoiceId' });
    }

    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
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
      success_url: 'https://hartman-estimate.vercel.app/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://hartman-estimate.vercel.app/cancel',
      metadata: {
        invoice_id: invoiceId,
        customer_name: customerName,
      },
    };

    let session;

    if (connectedAccountId) {
      // CONNECTED ACCOUNT — transfer funds, take platform fee
      session = await stripe.checkout.sessions.create(
        {
          ...sessionParams,
          payment_intent_data: {
            application_fee_amount: Math.round(amount * 0.005), // 5% platform fee (adjust as needed)
            transfer_data: {
              destination: connectedAccountId,
            },
          },
        },
        { stripeAccount: connectedAccountId }
      );
    } else {
      // DIRECT CHARGE — no Connect
      session = await stripe.checkout.sessions.create(sessionParams);
    }

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: err.message,
    });
  }
}

// Required for larger payloads
export const config = {
  api: {
    bodyParser: true,
  },
};
