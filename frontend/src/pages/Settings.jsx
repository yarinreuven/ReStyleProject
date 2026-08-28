import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import ProfileAvatar from "../components/ProfileAvatar";
import usePageStyles from "../hooks/usePageStyles";
import { useAuth } from "../context/AuthContext";

const AUTH_URL = "http://localhost:3001/api/auth";
const sections = [
  { id: "profile", label: "Personal Information", icon: "fa-regular fa-user" },
  { id: "password", label: "Password & Security", icon: "fa-solid fa-lock" },
  { id: "blocked", label: "Blocked Users", icon: "fa-solid fa-user-slash" },
  { id: "delete", label: "Delete Account", icon: "fa-regular fa-trash-can" }
];

export default function Settings() {
  usePageStyles("settings.css");
  usePageStyles("settings-fields.css");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, token, logout, updateUser } = useAuth();
  const [activeSection, setActiveSection] = useState(() => searchParams.get("section") === "delete" ? "delete" : "profile");
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", email: "", gender: "unspecified" });
  const [emailCode, setEmailCode] = useState("");
  const [emailVerificationPending, setEmailVerificationPending] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [requestError, setRequestError] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailRequestError, setEmailRequestError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    setProfileForm({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      gender: user?.gender || "unspecified"
    });
  }, [user?.email, user?.firstName, user?.gender, user?.lastName]);

  useEffect(() => {
    if (activeSection !== "blocked" || !token) return;
    let active = true;
    setIsLoadingBlocked(true);
    setRequestError("");
    setEmailMessage("");
    setEmailRequestError("");
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
    setEmailMessage("");
    setEmailRequestError("");
  }

  function updateProfileField(event) {
    setProfileForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setErrors((current) => ({ ...current, [event.target.name]: "" }));
  }

  function updatePasswordField(event) {
    setPasswordForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setErrors((current) => ({ ...current, [event.target.name]: "" }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    const firstName = profileForm.firstName.trim();
    const lastName = profileForm.lastName.trim();
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
        { firstName, lastName, gender: profileForm.gender },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      updateUser(data.user);
      setMessage("Your personal information was updated.");
    } catch (error) {
      if (error.response?.status === 401) logout();
      else setRequestError(error.response?.data?.message || "Could not update your personal information.");
    } finally {
      setIsSaving(false);
    }
  }

  async function requestEmailVerification() {
    const email = profileForm.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors((current) => ({ ...current, email: "Enter a valid email address." }));
      return;
    }
    if (email === user.email.toLowerCase()) {
      setErrors((current) => ({ ...current, email: "Enter a different email address." }));
      return;
    }

    try {
      setIsSaving(true);
      setEmailMessage("");
      setEmailRequestError("");
      const { data } = await axios.post(`${AUTH_URL}/email-change/request`, { email }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmailVerificationPending(true);
      setEmailCode("");
      setEmailMessage(data.message);
    } catch (error) {
      if (error.response?.status === 401) logout();
      else setEmailRequestError(error.response?.data?.message || "Could not send the verification code.");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmEmailVerification() {
    if (!/^\d{6}$/.test(emailCode)) {
      setErrors((current) => ({ ...current, emailCode: "Enter the 6-digit code." }));
      return;
    }

    try {
      setIsSaving(true);
      setEmailMessage("");
      setEmailRequestError("");
      const { data } = await axios.post(`${AUTH_URL}/email-change/confirm`, { code: emailCode }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      updateUser(data.user);
      setEmailVerificationPending(false);
      setEmailCode("");
      setEmailMessage(data.message);
    } catch (error) {
      if (error.response?.status === 401) logout();
      else setEmailRequestError(error.response?.data?.message || "Could not verify the email address.");
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

  async function deleteAccount() {
    try {
      setIsDeletingAccount(true);
      setRequestError("");
      await axios.delete(`${AUTH_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { confirmation: "DELETE" }
      });
      const userId = user.id || user._id;
      if (userId) sessionStorage.removeItem(`restyle:outfit-builder:${userId}`);
      logout();
      navigate("/register", { replace: true });
    } catch (error) {
      setDeleteDialogOpen(false);
      if (error.response?.status === 401) logout();
      else setRequestError(error.response?.data?.message || "Could not delete your account. Nothing was deleted from the browser.");
    } finally {
      setIsDeletingAccount(false);
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
            <header><h2>Personal Information</h2><p>Update your name, email address and gender.</p></header>
            <form onSubmit={saveProfile} className="settings-form" noValidate>
              <div className="settings-two-columns">
                <Field label="First name" name="firstName" value={profileForm.firstName} error={errors.firstName} onChange={updateProfileField} autoComplete="given-name" />
                <Field label="Last name" name="lastName" value={profileForm.lastName} error={errors.lastName} onChange={updateProfileField} autoComplete="family-name" />
              </div>
              <label className="settings-field"><span>Gender</span><select name="gender" value={profileForm.gender} onChange={updateProfileField}><option value="female">Female</option><option value="male">Male</option><option value="unspecified">Prefer not to say</option></select></label>
              <Feedback message={message} error={requestError} />
              <button className="settings-primary-btn" disabled={isSaving} type="submit">{isSaving ? "Saving..." : "Save Changes"}</button>
            </form>
            <section className="settings-email-change">
              <h3>Change Email Address</h3>
              <p>Your current email is <strong>{user.email}</strong>. We will send a 6-digit verification code to the new address.</p>
              <Field type="email" label="New email address" name="email" value={profileForm.email} error={errors.email} onChange={updateProfileField} autoComplete="email" />
              <Feedback message={emailMessage} error={emailRequestError} />
              {!emailVerificationPending ? (
                <button className="settings-primary-btn" disabled={isSaving} type="button" onClick={requestEmailVerification}>{isSaving ? "Sending..." : "Send Verification Code"}</button>
              ) : <>
                <Field label="Verification code" name="emailCode" inputMode="numeric" value={emailCode} error={errors.emailCode} onChange={(event) => { setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setErrors((current) => ({ ...current, emailCode: "" })); }} autoComplete="one-time-code" hint="The code expires in 15 minutes" />
                <div className="settings-email-actions"><button className="settings-primary-btn" disabled={isSaving} type="button" onClick={confirmEmailVerification}>{isSaving ? "Verifying..." : "Verify and Change Email"}</button><button type="button" disabled={isSaving} onClick={requestEmailVerification}>Send again</button></div>
              </>}
            </section>
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

          {activeSection === "delete" && <>
            <header><h2>Delete Account</h2><p>Permanently remove your ReStyle account and its associated data.</p></header>
            <section className="settings-danger-zone">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <div>
                <h3>This action cannot be undone</h3>
                <p>Your wardrobe items and images, saved looks, virtual try-ons, Studio projects, favorites, conversations, payment records and account profile will be permanently deleted.</p>
              </div>
            </section>
            <Feedback error={requestError} />
            <button className="settings-delete-btn" type="button" disabled={isDeletingAccount} onClick={() => { setRequestError(""); setDeleteDialogOpen(true); }}>
              Delete My Account
            </button>
          </>}
        </section>
      </section>

      {deleteDialogOpen && (
        <div className="settings-delete-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDeletingAccount) setDeleteDialogOpen(false); }}>
          <section className="settings-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title" aria-describedby="delete-account-description">
            <div className="settings-delete-dialog-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
            <h2 id="delete-account-title">Are you sure you want to delete your account?</h2>
            <p id="delete-account-description">Once your account is deleted, everything you uploaded—including wardrobe images, saved looks, Studio projects and conversations—will be permanently deleted. This action cannot be undone.</p>
            <div className="settings-delete-dialog-actions">
              <button type="button" disabled={isDeletingAccount} onClick={() => setDeleteDialogOpen(false)}>No, keep my account</button>
              <button type="button" disabled={isDeletingAccount} onClick={deleteAccount}>{isDeletingAccount ? "Deleting..." : "Yes, delete my account"}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Field({ label, error, hint, type = "text", ...inputProps }) {
  return <label className="settings-field"><span>{label}</span><input type={type} maxLength="100" aria-invalid={Boolean(error)} {...inputProps} />{error ? <small className="field-error">{error}</small> : hint ? <small>{hint}</small> : null}</label>;
}

function Feedback({ message, error }) {
  return <>{message && <p className="settings-success">{message}</p>}{error && <p className="settings-error">{error}</p>}</>;
}
