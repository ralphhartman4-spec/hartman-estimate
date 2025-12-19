import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error('Stripe Connect error:', error, error_description);
    return res.redirect('https://hartman-estimate.vercel.app/?stripe_connect=error');
  }

  if (!code) {
    return res.redirect('https://hartman-estimate.vercel.app/?stripe_connect=missing_code');
  }

  try {
    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    });

    const connectedAccountId = response.stripe_user_id;

    // Redirect back to the Expo app with the account ID
    // This uses Expo's custom URL scheme (exp://)
    // Adjust if your app uses a different scheme (e.g., hartmanestimate://)
    // After getting connectedAccountId
res.redirect(`exp://127.0.0.1:8081/--/?connectedAccountId=${connectedAccountId}`);
  } catch (err) {
    console.error('Stripe OAuth token error:', err);
    res.redirect('https://hartman-estimate.vercel.app/?stripe_connect=failed');
  }
}
