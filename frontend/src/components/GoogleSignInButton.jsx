import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config/api";

const GOOGLE_SCRIPT_ID = "google-identity-services";

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function GoogleSignInButton({ intent, termsAccepted, onError }) {
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    let active = true;
    if (!clientId) {
      setIsLoading(false);
      onError?.("Google sign-in is not configured yet.");
      return undefined;
    }

    loadGoogleScript().then(() => {
      if (!active || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try {
            onError?.("");
            const { data } = await axios.post(
              `${API_BASE_URL}/auth/google`,
              { credential, intent, ...(intent === "register" ? { termsAccepted } : {}) },
              { withCredentials: true }
            );
            login(data.token, data.user);
            navigate("/closet", { replace: true });
          } catch (error) {
            onError?.(error.response?.data?.message || "Google sign-in failed. Please try again.");
          }
        }
      });
      buttonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: buttonRef.current.clientWidth || 360
      });
      setIsLoading(false);
    }).catch(() => {
      if (active) {
        setIsLoading(false);
        onError?.("Could not load Google sign-in. Please try again.");
      }
    });

    return () => { active = false; };
  }, [clientId, intent, login, navigate, onError, termsAccepted]);

  return <div className="google-signin-wrap">
    {isLoading && <span className="google-signin-loading">Loading Google sign-in...</span>}
    <div ref={buttonRef} />
  </div>;
}
