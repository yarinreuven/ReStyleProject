import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import HangerBrand from "../components/HangerBrand";
import usePageStyles from "../hooks/usePageStyles";

export default function ForgotPassword() {
  usePageStyles("forgot-password.css");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!email.trim()) return setError("Email is required");
    if (!email.includes("@")) return setError("Invalid email format");
    try {
      setIsSending(true);
      setError("");
      setMessage("");
      const { data } = await axios.post(
        "http://localhost:3001/api/auth/forgot-password",
        { email: email.trim() }
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
          <input type="email" placeholder="Email Address" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); setMessage(""); }} className={error ? "input-error" : ""} />
          <p className="error-message">{error}</p>
          {message && <p className="reset-success">{message}</p>}
          <button type="submit" className="reset-btn" disabled={isSending}>{isSending ? "Sending..." : "Send Reset Link"}</button>
        </form>
        <div className="login-link">Remember your password? <Link to="/login">Login</Link></div>
      </div>
    </div>
  );
}
