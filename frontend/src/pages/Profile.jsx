import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ProfileAvatar from "../components/ProfileAvatar";
import usePageStyles from "../hooks/usePageStyles";

const PROFILE_IMAGE_URL =
  "http://localhost:3001/api/auth/profile-image";

export default function Profile() {
  usePageStyles("profile.css");

  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  });
  const [token] = useState(() => localStorage.getItem("token"));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !token) {
      navigate("/login", { replace: true });
    }
  }, [navigate, token, user]);

  function saveUser(nextUser) {
    setUser(nextUser);
    localStorage.setItem("user", JSON.stringify(nextUser));
  }

  async function changeImage(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setError("Please choose a JPG, PNG or WEBP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Profile image must be smaller than 5MB.");
      event.target.value = "";
      return;
    }

    const body = new FormData();
    body.append("profileImage", file);

    try {
      setIsSaving(true);
      setError("");
      setMessage("");

      await axios.put(PROFILE_IMAGE_URL, body, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      saveUser({
        ...user,
        hasProfileImage: true,
        profileImageUpdatedAt: Date.now()
      });
      setMessage("Profile picture updated successfully.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not update your profile picture."
      );
    } finally {
      setIsSaving(false);
      event.target.value = "";
    }
  }

  async function removeImage() {
    if (!window.confirm("Remove your profile picture?")) {
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      setMessage("");

      await axios.delete(PROFILE_IMAGE_URL, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      saveUser({
        ...user,
        hasProfileImage: false,
        profileImageUpdatedAt: Date.now()
      });
      setMessage("Profile picture removed.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not remove your profile picture."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!user || !token) {
    return null;
  }

  return (
    <main className="profile-page">
      <button
        type="button"
        className="profile-back-btn"
        onClick={() => navigate("/closet")}
      >
        ← Back to My Closet
      </button>

      <section className="profile-card">
        <h1>My Profile</h1>
        <p className="profile-subtitle">
          Manage your personal profile picture
        </p>

        <ProfileAvatar token={token} user={user} size="large" />

        <h2>{user.firstName} {user.lastName}</h2>
        <p className="profile-email">{user.email}</p>

        <input
          ref={fileInputRef}
          className="profile-file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={changeImage}
        />

        <div className="profile-actions">
          <button
            type="button"
            className="change-photo-btn"
            disabled={isSaving}
            onClick={() => fileInputRef.current?.click()}
          >
            {isSaving ? "Saving..." : "Change Picture"}
          </button>

          {user.hasProfileImage && (
            <button
              type="button"
              className="remove-photo-btn"
              disabled={isSaving}
              onClick={removeImage}
            >
              Remove Picture
            </button>
          )}
        </div>

        <p className="profile-help">JPG, PNG or WEBP, up to 5MB</p>
        {message && <p className="profile-success">{message}</p>}
        {error && <p className="profile-error">{error}</p>}
      </section>
    </main>
  );
}
