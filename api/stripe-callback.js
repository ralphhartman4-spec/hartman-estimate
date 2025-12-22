import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error('Stripe Connect error:', error, error_description);
    // Redirect to app with failure (or show error page)
    return res.redirect('/?stripe_connect=failed');
  }

  if (!code) {
    return res.status(400).send('No authorization code provided');
  }

  try {
    // Exchange code for access token and connected account ID
    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    });

    const connectedAccountId = response.stripe_user_id;

    // Save to AsyncStorage in the app (you'll handle this on frontend after redirect)
    // For now, redirect back to app with success
    res.redirect(`hartmanestimate://stripe-connected?accountId=${connectedAccountId}`);
  } catch (err) {
    console.error('OAuth token exchange failed:', err);
    res.redirect('/?stripe_connect=failed');
  }
}
