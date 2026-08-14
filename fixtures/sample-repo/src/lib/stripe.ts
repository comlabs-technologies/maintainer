import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
  typescript: true,
});

export async function getCustomer(id: string) {
  return stripe.customers.retrieve(id);
}
