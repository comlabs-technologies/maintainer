import { stripe } from "../../lib/stripe.ts";

export async function constructEvent(payload: string, signature: string) {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET as string,
  );
}
