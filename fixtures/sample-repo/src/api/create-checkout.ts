import { stripe } from "../lib/stripe.ts";

export async function createCheckout(customerId: string, priceId: string) {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: "https://example.com/success",
    cancel_url: "https://example.com/cancel",
  });
  return session.id;
}

export async function createCustomer(source: string) {
  return stripe.customers.create({
    source,
  });
}

export async function createSecondCustomer(source: string) {
  return stripe.customers.create({
    email: "ops@example.com",
    source,
  });
}
