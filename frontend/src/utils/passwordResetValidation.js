const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const resetTokenPattern = /^[a-f\d]{64}$/i;

export function validateForgotPasswordEmail(value) {
  const email = value.trim().toLowerCase();
  if (!email) return { email, error: "Email is required" };
  if (!emailPattern.test(email)) {
    return { email, error: "Please enter a valid email address" };
  }
  return { email, error: "" };
}

export function validateResetPassword(token, form) {
  if (!resetTokenPattern.test(token)) {
    return "This password reset link is invalid.";
  }
  if (!form.newPassword) return "New password is required.";
  if (form.newPassword.length < 6) {
    return "Password must contain at least 6 characters.";
  }
  if (form.newPassword.length > 100) {
    return "Password cannot contain more than 100 characters.";
  }
  if (!form.confirmPassword) return "Please confirm your new password.";
  if (form.newPassword !== form.confirmPassword) return "Passwords do not match.";
  return "";
}
