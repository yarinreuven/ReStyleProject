import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import HangerBrand from "../components/HangerBrand";
import usePageStyles from "../hooks/usePageStyles";

const initialValues = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
  language: "en"
};

export default function Register() {
  usePageStyles("register.css");

  const navigate = useNavigate();

  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    setSuccess("");
  }

  async function submit(event) {
    event.preventDefault();

    setSuccess("");

    const nextErrors = {};

    const firstName = values.firstName.trim();
    const lastName = values.lastName.trim();
    const email = values.email.trim().toLowerCase();

    if (!firstName) {
      nextErrors.firstName = "First name is required";
    } else if (firstName.length < 2) {
      nextErrors.firstName =
        "First name must contain at least 2 characters";
    } else if (firstName.length > 50) {
      nextErrors.firstName =
        "First name cannot contain more than 50 characters";
    }

    if (!lastName) {
      nextErrors.lastName = "Last name is required";
    } else if (lastName.length < 2) {
      nextErrors.lastName =
        "Last name must contain at least 2 characters";
    } else if (lastName.length > 50) {
      nextErrors.lastName =
        "Last name cannot contain more than 50 characters";
    }

    if (!email) {
      nextErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Please enter a valid email address";
    }

    if (!values.password) {
      nextErrors.password = "Password is required";
    } else if (values.password.length < 6) {
      nextErrors.password =
        "Password must contain at least 6 characters";
    } else if (values.password.length > 100) {
      nextErrors.password =
        "Password cannot contain more than 100 characters";
    }

    if (!values.confirmPassword) {
      nextErrors.confirmPassword =
        "Confirm password is required";
    } else if (values.confirmPassword !== values.password) {
      nextErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      setIsSubmitting(true);

      const { data } = await axios.post(
        "http://localhost:3001/api/auth/register",
        {
          firstName,
          lastName,
          email,
          password: values.password,
          confirmPassword: values.confirmPassword,
          language: values.language
        }
      );

      if (data.success) {
        localStorage.setItem("token", data.token);
        localStorage.setItem(
          "user",
          JSON.stringify(data.user)
        );

        setSuccess("Account created successfully!");

        setTimeout(() => {
          navigate("/closet");
        }, 1000);
      }
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Server error. Please try again.";

      if (
        error.response?.status === 409 ||
        message === "Account already exists"
      ) {
        setErrors({
          email: "An account with this email already exists"
        });
      } else {
        setErrors({
          email: message
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="register-page">
      <Link to="/" className="back-home">
        ← Back to Home
      </Link>

      <div className="register-card">
        <HangerBrand />

        <label
          className="language-label"
          htmlFor="language"
        >
          Preferred Language
        </label>

        <select
          id="language"
          name="language"
          value={values.language}
          onChange={change}
        >
          <option value="en">English</option>
          <option value="he">Hebrew</option>
        </select>

        <h1>Create Account</h1>

        <p className="subtitle">
          Join ReStyle and start building your smart wardrobe
        </p>

        <form onSubmit={submit} noValidate>
          <div className="name-row">
            <div>
              <input
                name="firstName"
                type="text"
                placeholder="First Name"
                value={values.firstName}
                onChange={change}
                className={
                  errors.firstName ? "input-error" : ""
                }
              />

              <p className="error-message">
                {errors.firstName || ""}
              </p>
            </div>

            <div>
              <input
                name="lastName"
                type="text"
                placeholder="Last Name"
                value={values.lastName}
                onChange={change}
                className={
                  errors.lastName ? "input-error" : ""
                }
              />

              <p className="error-message">
                {errors.lastName || ""}
              </p>
            </div>
          </div>

          <input
            name="email"
            type="email"
            placeholder="Email"
            value={values.email}
            onChange={change}
            className={errors.email ? "input-error" : ""}
          />

          <p className="error-message">
            {errors.email || ""}
          </p>

          {success && (
            <p className="success-message">
              {success}
            </p>
          )}

          <input
            name="password"
            type="password"
            placeholder="Password"
            value={values.password}
            onChange={change}
            className={
              errors.password ? "input-error" : ""
            }
          />

          <p className="error-message">
            {errors.password || ""}
          </p>

          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm Password"
            value={values.confirmPassword}
            onChange={change}
            className={
              errors.confirmPassword ? "input-error" : ""
            }
          />

          <p className="error-message">
            {errors.confirmPassword || ""}
          </p>

          <label className="upload-box">
            <span>Upload Profile Picture (Optional)</span>
            <input type="file" accept="image/*" />
          </label>

          <button
            type="submit"
            className="register-btn"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Creating Account..."
              : "Create Account"}
          </button>

          <div className="divider">
            <span>OR</span>
          </div>

          <button type="button" className="google-btn">
            <img
              src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg"
              alt="Google"
            />
            Continue with Google
          </button>
        </form>

        <div className="login-link">
          Already have an account?{" "}
          <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
}