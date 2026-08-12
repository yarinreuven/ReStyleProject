import { useState } from "react";
import axios from "axios";
import {
  Link,
  useNavigate
} from "react-router-dom";
import HangerBrand from "../components/HangerBrand";
import usePageStyles from "../hooks/usePageStyles";

const initialValues = {
  email: "",
  password: ""
};

export default function Login() {
  usePageStyles("login.css");

  const navigate = useNavigate();

  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] =
    useState(false);

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
        "http://localhost:3001/api/auth/login",
        {
          email,
          password: values.password
        }
      );

      if (data.success) {
        localStorage.setItem(
          "token",
          data.token
        );

        localStorage.setItem(
          "user",
          JSON.stringify(data.user)
        );

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

          <button
            type="button"
            className="google-btn"
          >
            <img
              src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg"
              alt="Google"
            />
            Continue with Google
          </button>
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