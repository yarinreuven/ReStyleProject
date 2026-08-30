import { useState } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import HangerBrand from "../components/HangerBrand";
import usePageStyles from "../hooks/usePageStyles";
import { API_BASE_URL } from "../config/api";
import { validateResetPassword } from "../utils/passwordResetValidation.js";

export default function ResetPassword() {
  usePageStyles("forgot-password.css");
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    const validationError = validateResetPassword(token, form);
    if (validationError) return setError(validationError);

    try {
      setIsSaving(true);
      setError("");
      const { data } = await axios.post(
        `${API_BASE_URL}/auth/reset-password`,
        { token, ...form }
      );
      setMessage(data.message);
      setForm({ newPassword: "", confirmPassword: "" });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not reset your password.");
    } finally {
      setIsSaving(false);
    }
  }

  return <div className="forgot-page">
    <Link to="/login" className="back-home">← Back to Login</Link>
    <div className="forgot-card">
      <HangerBrand />
      <h1>Create New Password</h1>
      <p className="subtitle">Choose a new password for your ReStyle account.</p>
      {message ? <div className="reset-complete"><p>{message}</p><Link to="/login">Continue to Login</Link></div> : <form onSubmit={submit} noValidate>
        <input id="newPassword" type="password" name="newPassword" placeholder="New Password" aria-label="New Password" aria-invalid={Boolean(error)} aria-describedby={error ? "resetPasswordError" : undefined} value={form.newPassword} onChange={updateField} autoComplete="new-password" maxLength="100" />
        <input id="confirmPassword" type="password" name="confirmPassword" placeholder="Confirm New Password" aria-label="Confirm New Password" aria-invalid={Boolean(error)} aria-describedby={error ? "resetPasswordError" : undefined} value={form.confirmPassword} onChange={updateField} autoComplete="new-password" maxLength="100" />
        <p id="resetPasswordError" className="error-message" role={error ? "alert" : undefined}>{error}</p>
        <button type="submit" className="reset-btn" disabled={isSaving}>{isSaving ? "Updating..." : "Reset Password"}</button>
      </form>}
    </div>
  </div>;
}
