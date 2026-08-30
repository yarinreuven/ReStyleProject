import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import HangerBrand from "../components/HangerBrand";
import { API_BASE_URL } from "../config/api";
import { validateForgotPasswordEmail } from "../utils/passwordResetValidation.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const validation = validateForgotPasswordEmail(email);
    if (validation.error) return setError(validation.error);
    try {
      setIsSending(true);
      setError("");
      setMessage("");
      const { data } = await axios.post(
        `${API_BASE_URL}/auth/forgot-password`,
        { email: validation.email }
      );
      setMessage(data.message);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not send the reset email. Please try again."
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="forgot-page">
      <Link to="/login" className="back-home">← Back to Login</Link>
      <div className="forgot-card">
        <HangerBrand />
        <h1>Forgot Password?</h1>
        <p className="subtitle">Enter your email and we'll send you a password reset link.</p>
        <form onSubmit={submit} noValidate>
          <input id="forgotEmail" type="email" placeholder="Email Address" aria-label="Email Address" aria-invalid={Boolean(error)} aria-describedby={error ? "forgotEmailError" : undefined} autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); setMessage(""); }} className={error ? "input-error" : ""} />
          <p id="forgotEmailError" className="error-message" role={error ? "alert" : undefined}>{error}</p>
          {message && <p className="reset-success" role="status">{message}</p>}
          <button type="submit" className="reset-btn" disabled={isSending}>{isSending ? "Sending..." : "Send Reset Link"}</button>
        </form>
        <div className="login-link">Remember your password? <Link to="/login">Login</Link></div>
      </div>
    </div>
  );
}
