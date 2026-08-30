const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginValues(values) {
  const errors = {};
  const email = values.email.trim().toLowerCase();

  if (!email) {
    errors.email = "Please enter your email.";
  } else if (!emailPattern.test(email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (!values.password.trim()) {
    errors.password = "Please enter your password.";
  }

  return { email, errors };
}
