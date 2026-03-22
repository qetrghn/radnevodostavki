// updated
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { amount, currency = 'eur', orderDetails } = req.body;
    const secretKey = process.env.STRIPE_SECRET_KEY;
    
    console.log('Secret key exists:', !!secretKey);
    console.log('Amount:', amount);

    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: Math.round(amount * 100).toString(),
        currency: currency,
        'automatic_payment_methods[enabled]': 'true',
      }).toString(),
    });

    const paymentIntent = await response.json();
    console.log('Stripe response status:', response.status);
    
    if (!response.ok) {
      return res.status(400).json({ error: paymentIntent.error?.message || 'Stripe error' });
    }

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
