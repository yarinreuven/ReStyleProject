import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const PAYPAL_API_URL = `${API_BASE_URL}/paypal`;

function loadPayPalSdk(clientId, currency) {
  if (window.paypal) return Promise.resolve(window.paypal);
  const existing = document.querySelector("script[data-restyle-paypal]");
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(window.paypal), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load PayPal")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}&intent=capture`;
    script.dataset.restylePaypal = "true";
    script.onload = () => resolve(window.paypal);
    script.onerror = () => reject(new Error("Could not load PayPal"));
    document.head.appendChild(script);
  });
}

export default function PayPalCheckout({ token, plan, product, onSuccess }) {
  const containerRef = useRef(null);
  const [message, setMessage] = useState("Loading secure PayPal checkout...");

  useEffect(() => {
    let cancelled = false;
    let buttons;

    async function renderButtons() {
      try {
        const { data: config } = await axios.get(`${PAYPAL_API_URL}/config`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const paypal = await loadPayPalSdk(config.clientId, config.currency);
        if (cancelled || !containerRef.current) return;
        setMessage("");
        buttons = paypal.Buttons({
          style: { layout: "vertical", shape: "pill", label: "paypal" },
          createOrder: async () => {
            const { data } = await axios.post(`${PAYPAL_API_URL}/orders`, { plan, product }, {
              headers: { Authorization: `Bearer ${token}` }
            });
            return data.id;
          },
          onApprove: async ({ orderID }) => {
            setMessage("Confirming your Sandbox payment...");
            const { data } = await axios.post(`${PAYPAL_API_URL}/orders/${orderID}/capture`, {}, {
              headers: { Authorization: `Bearer ${token}` }
            });
            onSuccess(data);
          },
          onCancel: () => setMessage("The payment was cancelled. No credits were added."),
          onError: (error) => {
            console.error("PayPal Checkout error", error);
            setMessage("PayPal could not complete the Sandbox payment. Please try again.");
          }
        });
        if (!buttons.isEligible()) throw new Error("PayPal is unavailable for this browser");
        await buttons.render(containerRef.current);
      } catch (error) {
        if (!cancelled) setMessage(error.response?.data?.message || error.message || "PayPal is unavailable.");
      }
    }

    renderButtons();
    return () => {
      cancelled = true;
      buttons?.close?.();
    };
  }, [onSuccess, plan, product, token]);

  return <div className="paypal-checkout"><div ref={containerRef} />{message && <p role="status">{message}</p>}</div>;
}
