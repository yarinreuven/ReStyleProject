import { useCallback, useState } from "react";
import axios from "axios";
import {
  Link,
  useNavigate
} from "react-router-dom";
import HangerBrand from "../components/HangerBrand";
import { useAuth } from "../context/AuthContext";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { API_BASE_URL } from "../config/api";
import { validateLoginValues } from "../utils/loginValidation.js";

const initialValues = {
  email: "",
  password: ""
};

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const setGoogleError = useCallback((message) => {
    setErrors((current) => ({ ...current, google: message }));
  }, []);

  function change(event) {
    const { name, value } = event.target;

    setValues((currentValues) => ({
      ...currentValues,
      [name]: value
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      [name]: ""
    }));
  }

  async function submit(event) {
    event.preventDefault();

    const { email, errors: nextErrors } = validateLoginValues(values);

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      setIsSubmitting(true);

      const { data } = await axios.post(
        `${API_BASE_URL}/auth/login`,
        {
          email,
          password: values.password
        },
        { withCredentials: true }
      );

      if (data.success) {
        login(data.token, data.user);

        navigate("/closet", {
          replace: true
        });
      }
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Server error. Please try again.";

      setErrors({
        password: message
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <Link to="/" className="back-home">
        ← Back to Home
      </Link>

      <div className="login-card">
        <HangerBrand />

        <h1>Welcome Back</h1>

        <p className="subtitle">
          Sign in to continue to your account
        </p>

        <form onSubmit={submit} noValidate>
          <div className="input-group">
            <input
              id="loginEmail"
              name="email"
              type="email"
              placeholder="Email"
              aria-label="Email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "loginEmailError" : undefined}
              autoComplete="email"
              value={values.email}
              onChange={change}
              className={
                errors.email ? "input-error" : ""
              }
            />

            <p id="loginEmailError" className="error-message" role={errors.email ? "alert" : undefined}>
              {errors.email || ""}
            </p>
          </div>

          <div className="input-group">
            <input
              id="loginPassword"
              name="password"
              type="password"
              placeholder="Password"
              aria-label="Password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "loginPasswordError" : undefined}
              autoComplete="current-password"
              value={values.password}
              onChange={change}
              className={
                errors.password
                  ? "input-error"
                  : ""
              }
            />

            <p id="loginPasswordError" className="error-message" role={errors.password ? "alert" : undefined}>
              {errors.password || ""}
            </p>
          </div>

          <div className="options">
            <Link to="/forgot-password">
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Logging in..."
              : "Login"}
          </button>

          <div className="divider">
            <span>OR</span>
          </div>

          <GoogleSignInButton intent="login" onError={setGoogleError} />
          {errors.google && <p className="google-error" role="alert">{errors.google}</p>}
        </form>

        <div className="register-link">
          Don’t have an account?{" "}
          <Link to="/register">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
