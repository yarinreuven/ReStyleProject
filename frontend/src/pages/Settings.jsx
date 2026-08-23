import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ProfileAvatar from "../components/ProfileAvatar";
import usePageStyles from "../hooks/usePageStyles";
import { useAuth } from "../context/AuthContext";

const AUTH_URL = "http://localhost:3001/api/auth";
const sections = [
  { id: "profile", label: "Personal Information", icon: "fa-regular fa-user" },
  { id: "password", label: "Password & Security", icon: "fa-solid fa-lock" },
  { id: "blocked", label: "Blocked Users", icon: "fa-solid fa-user-slash" }
];

export default function Settings() {
  usePageStyles("settings.css");
  const navigate = useNavigate();
  const { user, token, logout, updateUser } = useAuth();
  const [activeSection, setActiveSection] = useState("profile");
  const [nameForm, setNameForm] = useState({ firstName: "", lastName: "" });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [requestError, setRequestError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);

  useEffect(() => {
    setNameForm({
      firstName: user?.firstName || "",
      lastName: user?.lastName || ""
    });
  }, [user?.firstName, user?.lastName]);

  useEffect(() => {
    if (activeSection !== "blocked" || !token) return;
    let active = true;
    setIsLoadingBlocked(true);
    setRequestError("");
    axios.get(`${AUTH_URL}/blocked-users`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(({ data }) => {
      if (active) setBlockedUsers(data.blockedUsers);
    }).catch((error) => {
      if (!active) return;
      if (error.response?.status === 401) logout();
      else setRequestError(error.response?.data?.message || "Could not load blocked users.");
    }).finally(() => {
      if (active) setIsLoadingBlocked(false);
    });
    return () => { active = false; };
  }, [activeSection, logout, token]);

  function selectSection(sectionId) {
    setActiveSection(sectionId);
    setErrors({});
    setMessage("");
    setRequestError("");
  }

  function updateNameField(event) {
    setNameForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setErrors((current) => ({ ...current, [event.target.name]: "" }));
  }

  function updatePasswordField(event) {
    setPasswordForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setErrors((current) => ({ ...current, [event.target.name]: "" }));
  }

  async function saveName(event) {
    event.preventDefault();
    const firstName = nameForm.firstName.trim();
    const lastName = nameForm.lastName.trim();
    const nextErrors = {};
    if (firstName.length < 2) nextErrors.firstName = "Enter at least 2 characters.";
    if (lastName.length < 2) nextErrors.lastName = "Enter at least 2 characters.";
    if (Object.keys(nextErrors).length) return setErrors(nextErrors);

    try {
      setIsSaving(true);
      setMessage("");
      setRequestError("");
      const { data } = await axios.put(
        `${AUTH_URL}/me`,
        { firstName, lastName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      updateUser(data.user);
      setMessage("Your personal information was updated.");
    } catch (error) {
      if (error.response?.status === 401) logout();
      else setRequestError(error.response?.data?.message || "Could not update your name.");
    } finally {
      setIsSaving(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!passwordForm.currentPassword) nextErrors.currentPassword = "Enter your current password.";
    if (passwordForm.newPassword.length < 6) nextErrors.newPassword = "Use at least 6 characters.";
    if (passwordForm.confirmPassword !== passwordForm.newPassword) nextErrors.confirmPassword = "Passwords do not match.";
    if (Object.keys(nextErrors).length) return setErrors(nextErrors);

    try {
      setIsSaving(true);
      setMessage("");
      setRequestError("");
      const { data } = await axios.put(`${AUTH_URL}/password`, passwordForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage(data.message);
    } catch (error) {
      if (error.response?.status === 401) logout();
      else setRequestError(error.response?.data?.message || "Could not update your password.");
    } finally {
      setIsSaving(false);
    }
  }

  async function unblock(blockedUser) {
    try {
      setRequestError("");
      await axios.delete(`${AUTH_URL}/blocked-users/${blockedUser.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBlockedUsers((current) => current.filter((entry) => entry.id !== blockedUser.id));
      setMessage(`${blockedUser.firstName} ${blockedUser.lastName} was unblocked.`);
    } catch (error) {
      setRequestError(error.response?.data?.message || "Could not unblock this user.");
    }
  }

  if (!user || !token) return null;

  return (
    <main className="settings-page">
      <button className="settings-back-btn" type="button" onClick={() => navigate(-1)}>← Back</button>
      <section className="settings-layout">
        <aside className="settings-sidebar">
          <div className="settings-account">
            <ProfileAvatar token={token} user={user} />
            <div><strong>{user.firstName} {user.lastName}</strong><span>{user.email}</span></div>
          </div>
          <h1>Account Settings</h1>
          <nav>
            {sections.map((section) => (
              <button key={section.id} type="button" className={activeSection === section.id ? "active" : ""} onClick={() => selectSection(section.id)}>
                <i className={section.icon} aria-hidden="true" /><span>{section.label}</span><i className="fa-solid fa-chevron-right" aria-hidden="true" />
              </button>
            ))}
          </nav>
        </aside>

        <section className="settings-content">
          {activeSection === "profile" && <>
            <header><h2>Personal Information</h2><p>Update the name displayed on your profile, listings and conversations.</p></header>
            <form onSubmit={saveName} className="settings-form" noValidate>
              <div className="settings-two-columns">
                <Field label="First name" name="firstName" value={nameForm.firstName} error={errors.firstName} onChange={updateNameField} autoComplete="given-name" />
                <Field label="Last name" name="lastName" value={nameForm.lastName} error={errors.lastName} onChange={updateNameField} autoComplete="family-name" />
              </div>
              <div className="settings-readonly"><span>Email address</span><strong>{user.email}</strong><small>Your email address cannot be changed here.</small></div>
              <Feedback message={message} error={requestError} />
              <button className="settings-primary-btn" disabled={isSaving} type="submit">{isSaving ? "Saving..." : "Save Changes"}</button>
            </form>
          </>}

          {activeSection === "password" && <>
            <header><h2>Password & Security</h2><p>Choose a strong password that you do not use on other websites.</p></header>
            <form onSubmit={savePassword} className="settings-form settings-password-form" noValidate>
              <Field type="password" label="Current password" name="currentPassword" value={passwordForm.currentPassword} error={errors.currentPassword} onChange={updatePasswordField} autoComplete="current-password" />
              <Field type="password" label="New password" name="newPassword" value={passwordForm.newPassword} error={errors.newPassword} onChange={updatePasswordField} autoComplete="new-password" hint="At least 6 characters" />
              <Field type="password" label="Confirm new password" name="confirmPassword" value={passwordForm.confirmPassword} error={errors.confirmPassword} onChange={updatePasswordField} autoComplete="new-password" />
              <Feedback message={message} error={requestError} />
              <button className="settings-primary-btn" disabled={isSaving} type="submit">{isSaving ? "Updating..." : "Update Password"}</button>
            </form>
          </>}

          {activeSection === "blocked" && <>
            <header><h2>Blocked Users</h2><p>Blocked users cannot exchange messages with you. You can unblock them at any time.</p></header>
            <Feedback message={message} error={requestError} />
            {isLoadingBlocked ? <div className="settings-empty">Loading blocked users...</div> : blockedUsers.length === 0 ? (
              <div className="settings-empty"><i className="fa-regular fa-circle-check" /><h3>No blocked users</h3><p>People you block will appear here.</p></div>
            ) : (
              <div className="settings-blocked-list">{blockedUsers.map((blockedUser) => (
                <article key={blockedUser.id}>
                  <div className="settings-user-initial">{blockedUser.firstName?.[0]?.toUpperCase()}</div>
                  <strong>{blockedUser.firstName} {blockedUser.lastName}</strong>
                  <button type="button" onClick={() => unblock(blockedUser)}>Unblock</button>
                </article>
              ))}</div>
            )}
          </>}
        </section>
      </section>
    </main>
  );
}

function Field({ label, error, hint, type = "text", ...inputProps }) {
  return <label className="settings-field"><span>{label}</span><input type={type} maxLength="100" aria-invalid={Boolean(error)} {...inputProps} />{error ? <small className="field-error">{error}</small> : hint ? <small>{hint}</small> : null}</label>;
}

function Feedback({ message, error }) {
  return <>{message && <p className="settings-success">{message}</p>}{error && <p className="settings-error">{error}</p>}</>;
}
