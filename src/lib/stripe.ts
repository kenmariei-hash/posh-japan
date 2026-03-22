import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export function canUseStripe() {
  return Boolean(stripeSecretKey);
}

export function getStripeServerClient() {
  if (!stripeSecretKey) {
    return null;
  }

  return new Stripe(stripeSecretKey);
}
