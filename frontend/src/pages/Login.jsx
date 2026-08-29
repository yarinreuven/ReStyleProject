import { useCallback, useState } from "react";
import axios from "axios";
import {
  Link,
  useNavigate
} from "react-router-dom";
import HangerBrand from "../components/HangerBrand";
import { useAuth } from "../context/AuthContext";
import usePageStyles from "../hooks/usePageStyles";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { API_BASE_URL } from "../config/api";

const initialValues = {
  email: "",
  password: ""
};

export default function Login() {
  usePageStyles("login.css");

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

    const nextErrors = {};
    const email = values.email
      .trim()
      .toLowerCase();

    if (!email) {
      nextErrors.email = "Please enter your email.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      nextErrors.email =
        "Please enter a valid email address.";
    }

    if (!values.password.trim()) {
      nextErrors.password =
        "Please enter your password.";
    }

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
              name="email"
              type="email"
              placeholder="Email"
              value={values.email}
              onChange={change}
              className={
                errors.email ? "input-error" : ""
              }
            />

            <p className="error-message">
              {errors.email || ""}
            </p>
          </div>

          <div className="input-group">
            <input
              name="password"
              type="password"
              placeholder="Password"
              value={values.password}
              onChange={change}
              className={
                errors.password
                  ? "input-error"
                  : ""
              }
            />

            <p className="error-message">
              {errors.password || ""}
            </p>
          </div>

          <div className="options">
            <label>
              <input type="checkbox" />
              Remember Me
            </label>

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
