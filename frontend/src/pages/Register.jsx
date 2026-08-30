import { useCallback, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import HangerBrand from "../components/HangerBrand";
import { useAuth } from "../context/AuthContext";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { API_BASE_URL } from "../config/api";

const initialValues = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
  gender: ""
};

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [profilePreview, setProfilePreview] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
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

    setSuccess("");
  }

  function chooseProfileImage(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        profileImage: "Please choose a JPG, PNG or WEBP image"
      }));
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        profileImage: "Profile image must be smaller than 5MB"
      }));
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setProfileImage(file);
      setProfilePreview(String(reader.result));
      setErrors((currentErrors) => ({
        ...currentErrors,
        profileImage: ""
      }));
    };

    reader.readAsDataURL(file);
  }

  function removeProfileImage() {
    setProfileImage(null);
    setProfilePreview("");
    setErrors((currentErrors) => ({
      ...currentErrors,
      profileImage: ""
    }));
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

    if (!values.gender) {
      nextErrors.gender = "Please select your gender";
    }

    if (!termsAccepted) {
      nextErrors.termsAccepted = "You must agree to the Terms of Service";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      setIsSubmitting(true);

      const body = new FormData();

      body.append("firstName", firstName);
      body.append("lastName", lastName);
      body.append("email", email);
      body.append("password", values.password);
      body.append("confirmPassword", values.confirmPassword);
      body.append("language", "en");
      body.append("gender", values.gender);
      body.append("termsAccepted", "true");

      if (profileImage) {
        body.append("profileImage", profileImage);
      }

      const { data } = await axios.post(
        `${API_BASE_URL}/auth/register`,
        body,
        { withCredentials: true }
      );

      if (data.success) {
        login(data.token, data.user);

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

          <fieldset className={
            `gender-picker${errors.gender ? " input-error" : ""}`
          }>
            <legend>Gender</legend>

            <label className={values.gender === "female" ? "selected" : ""}>
              <input
                type="radio"
                name="gender"
                value="female"
                checked={values.gender === "female"}
                onChange={change}
              />
              <i className="fa-solid fa-venus" />
              <span>Female</span>
            </label>

            <label className={values.gender === "male" ? "selected" : ""}>
              <input
                type="radio"
                name="gender"
                value="male"
                checked={values.gender === "male"}
                onChange={change}
              />
              <i className="fa-solid fa-mars" />
              <span>Male</span>
            </label>
          </fieldset>

          <p className="error-message">
            {errors.gender || ""}
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

          <div className="profile-upload">
            {profilePreview && (
              <img
                className="profile-preview"
                src={profilePreview}
                alt="Selected profile preview"
              />
            )}

            <label className="upload-box">
              <span>
                {profileImage
                  ? profileImage.name
                  : "Upload Profile Picture (Optional)"}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={chooseProfileImage}
              />
            </label>

            {profileImage && (
              <button
                type="button"
                className="remove-image-btn"
                onClick={removeProfileImage}
              >
                Remove picture
              </button>
            )}

            <p className="profile-image-help">
              JPG, PNG or WEBP, up to 5MB
            </p>

            <p className="error-message">
              {errors.profileImage || ""}
            </p>
          </div>

          <div className={`terms-consent${errors.termsAccepted ? " terms-consent-error" : ""}`}>
            <label>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => {
                  setTermsAccepted(event.target.checked);
                  setErrors((current) => ({ ...current, termsAccepted: "", google: "" }));
                }}
              />
              <span>I have read and agree to the</span>
            </label>
            <button type="button" onClick={() => setTermsOpen(true)}>Terms of Service</button>
          </div>
          <p className="error-message terms-error">{errors.termsAccepted || ""}</p>

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

          <div className={!termsAccepted ? "google-terms-disabled" : ""}>
            <GoogleSignInButton intent="register" termsAccepted={termsAccepted} onError={setGoogleError} />
          </div>
          {!termsAccepted && <p className="google-terms-help">Agree to the Terms of Service before registering with Google.</p>}
          {errors.google && <p className="google-error" role="alert">{errors.google}</p>}
        </form>

        <div className="login-link">
          Already have an account?{" "}
          <Link to="/login">Login</Link>
        </div>
      </div>

      {termsOpen && (
        <div className="terms-modal-backdrop" role="presentation" onMouseDown={() => setTermsOpen(false)}>
          <section className="terms-modal" role="dialog" aria-modal="true" aria-labelledby="terms-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span>RESTYLE</span><h2 id="terms-modal-title">Terms of Service</h2></div><button type="button" aria-label="Close Terms of Service" onClick={() => setTermsOpen(false)}>×</button></header>
            <div className="terms-modal-content">
              <h3>A respectful and safe community</h3>
              <p>By creating an account, you agree to provide accurate information, protect your account and use ReStyle responsibly.</p>
              <h3>Marketplace behavior</h3>
              <ul><li>Use respectful and appropriate language.</li><li>Do not harass, threaten, discriminate, spam or scam.</li><li>Describe listed items, their condition and price truthfully.</li><li>Do not list counterfeit, stolen, unsafe or unlawful items.</li><li>Respect other members’ privacy and report suspicious behavior.</li></ul>
              <h3>AI features and uploaded content</h3>
              <p>Virtual try-ons, item recognition and Studio ideas may be inaccurate and are provided as visual guidance. Upload only content you own or have permission to use.</p>
              <h3>Account and enforcement</h3>
              <p>ReStyle may remove content or restrict accounts that violate these rules. Account deletion is permanent and removes associated data as described in Settings.</p>
              <p className="terms-modal-note">This window is a readable summary. The full terms remain available on the dedicated Terms of Service page.</p>
            </div>
            <footer><Link to="/terms" target="_blank" rel="noreferrer">Read the full Terms</Link><button type="button" onClick={() => { setTermsAccepted(true); setTermsOpen(false); setErrors((current) => ({ ...current, termsAccepted: "" })); }}>I Agree</button></footer>
          </section>
        </div>
      )}
    </div>
  );
}
