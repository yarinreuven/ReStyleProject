import { randomUUID } from "node:crypto";

export const PAYPAL_PLANS = {
  mini: { credits: 10, amount: "9.90" },
  style: { credits: 30, amount: "19.90" }
} as const;

export const PAYPAL_RESTYLE_PLANS = {
  mini: { credits: 5, amount: "15.00" },
  style: { credits: 10, amount: "30.00" }
} as const;

export type PayPalPlan = keyof typeof PAYPAL_PLANS;
export type PayPalProduct = "tryon" | "restyle";

export function getPayPalPlan(product: PayPalProduct, plan: PayPalPlan) {
  return product === "restyle" ? PAYPAL_RESTYLE_PLANS[plan] : PAYPAL_PLANS[plan];
}

const currency = "ILS";

function configuration() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const environment = process.env.PAYPAL_ENV || "sandbox";
  if (environment !== "sandbox") throw new Error("Only PayPal Sandbox is enabled");
  if (!clientId || !clientSecret) throw new Error("PayPal Sandbox is not configured");
  return { clientId, clientSecret, baseUrl: "https://api-m.sandbox.paypal.com" };
}

async function paypalRequest(path: string, init: RequestInit = {}) {
  const { clientId, clientSecret, baseUrl } = configuration();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const tokenBody = await tokenResponse.json() as { access_token?: string; error_description?: string };
  if (!tokenResponse.ok || !tokenBody.access_token) {
    throw new Error(tokenBody.error_description || "PayPal authentication failed");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${tokenBody.access_token}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  const body = await response.json() as Record<string, any>;
  if (!response.ok) {
    const issue = body.details?.[0]?.issue || body.message || `PayPal request failed (${response.status})`;
    const error = new Error(issue) as Error & { paypalBody?: Record<string, any> };
    error.paypalBody = body;
    throw error;
  }
  return body;
}

export function getPayPalClientConfiguration() {
  const { clientId } = configuration();
  return { clientId, currency, environment: "sandbox" as const };
}

export async function createPayPalOrder(plan: PayPalPlan, product: PayPalProduct, userId: string) {
  const selected = getPayPalPlan(product, plan);
  const productName = product === "restyle" ? "ReStyle Studio" : "Virtual Try-on";
  return paypalRequest("/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": randomUUID() },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        custom_id: `${userId}:${product}:${plan}`,
        description: `${productName} · ${selected.credits} credits`,
        amount: { currency_code: currency, value: selected.amount }
      }],
      payment_source: {
        paypal: { experience_context: { locale: "he-IL", user_action: "PAY_NOW" } }
      }
    })
  });
}

export async function capturePayPalOrder(orderId: string) {
  try {
    return await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      headers: { "PayPal-Request-Id": `capture-${orderId}` }
    });
  } catch (error) {
    const current = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
    if (current.status === "COMPLETED") return current;
    throw error;
  }
}

export async function verifyPayPalWebhook(headers: Record<string, string | string[] | undefined>, event: unknown) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error("PayPal webhook is not configured");
  const required = (name: string) => {
    const value = headers[name];
    if (typeof value !== "string" || !value) throw new Error(`Missing ${name}`);
    return value;
  };
  const result = await paypalRequest("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: required("paypal-auth-algo"),
      cert_url: required("paypal-cert-url"),
      transmission_id: required("paypal-transmission-id"),
      transmission_sig: required("paypal-transmission-sig"),
      transmission_time: required("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event
    })
  });
  return result.verification_status === "SUCCESS";
}
