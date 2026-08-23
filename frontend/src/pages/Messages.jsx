import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import ProfileAvatar from "../components/ProfileAvatar";
import usePageStyles from "../hooks/usePageStyles";
import { useAuth } from "../context/AuthContext";

const API_URL = "http://localhost:3001/api/messages";

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short"
  }).format(new Date(value));
}

function ChatAvatar({ user, className = "" }) {
  if (user?.avatar) return <img className={className} src={user.avatar} alt="" />;
  const initial = user?.name?.trim().charAt(0).toUpperCase() || "?";
  return <span className={`messages-avatar-fallback ${className}`.trim()} aria-hidden="true">{initial}</span>;
}

export default function Messages() {
  usePageStyles("messages.css");
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const messagesEndRef = useRef(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { user, token, logout: logoutUser } = useAuth();
  const currentUserId = String(user?.id || user?._id || "");
  const requestConfig = useMemo(() => ({
    headers: { Authorization: `Bearer ${token}` }
  }), [token]);

  const logout = useCallback(() => {
    logoutUser();
    navigate("/login", { replace: true });
  }, [logoutUser, navigate]);

  useEffect(() => {
    if (!user || !token) navigate("/login", { replace: true });
  }, [navigate, token, user]);

  const loadConversations = useCallback(async () => {
    try {
      setErrorMessage("");
      const { data } = await axios.get(`${API_URL}/conversations`, requestConfig);
      setConversations(data.conversations || []);
      return data.conversations || [];
    } catch (error) {
      if (error.response?.status === 401) logout();
      else setErrorMessage(error.response?.data?.message || "Could not load your conversations.");
      return [];
    }
  }, [logout, requestConfig]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function loadPage() {
      setStatus("loading");
      const list = await loadConversations();
      if (cancelled) return;
      const selectedId = conversationId || list[0]?.id;
      if (!selectedId) {
        setActiveConversation(null);
        setStatus("ready");
        return;
      }
      try {
        const { data } = await axios.get(`${API_URL}/conversations/${selectedId}`, requestConfig);
        if (!cancelled) {
          setActiveConversation(data.conversation);
          setStatus("ready");
          if (!conversationId) navigate(`/messages/${selectedId}`, { replace: true });
        }
      } catch (error) {
        if (!cancelled) {
          if (error.response?.status === 401) {
            logout();
            return;
          }
          setStatus(error.response?.status === 404 ? "not-found" : "error");
          setErrorMessage(error.response?.data?.message || "Could not load this conversation.");
        }
      }
    }
    loadPage();
    return () => { cancelled = true; };
  }, [conversationId, loadConversations, logout, navigate, requestConfig, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages]);

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeConversation || sending) return;
    try {
      setSending(true);
      setErrorMessage("");
      const { data } = await axios.post(
        `${API_URL}/conversations/${activeConversation.id}/messages`,
        { text },
        requestConfig
      );
      setActiveConversation(data.conversation);
      setDraft("");
      await loadConversations();
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        return;
      }
      setErrorMessage(error.response?.data?.message || "Could not send your message.");
    } finally {
      setSending(false);
    }
  }

  if (!user || !token) return null;

  return (
    <div className="messages-page">
      <header className="messages-topbar">
        <button className="messages-logo" type="button" onClick={() => navigate("/")}>Re<span>Style</span></button>
        <nav><button type="button" onClick={() => navigate("/")}>Home</button><button type="button" onClick={() => navigate("/closet")}>My Closet</button><button type="button" onClick={() => navigate("/marketplace")}>Marketplace</button><button type="button" className="active">Messages</button></nav>
        <button type="button" className="messages-account" onClick={() => navigate("/profile")}><ProfileAvatar token={token} user={user} /><span>{user.firstName}</span></button>
      </header>

      <main className="messages-main">
        <div className="messages-title"><span>YOUR CONVERSATIONS</span><h1>Messages</h1><p>Connect securely with ReStyle members about their listed pieces.</p></div>
        {errorMessage && <p className="messages-error" role="alert">{errorMessage}</p>}

        {status === "loading" ? <div className="messages-state"><span className="messages-spinner" /><h2>Loading messages...</h2></div> : conversations.length === 0 ? <div className="messages-state"><i className="fa-regular fa-comments" /><h2>No conversations yet</h2><p>Open a marketplace item and contact its seller to start a conversation.</p><button type="button" onClick={() => navigate("/marketplace")}>Explore Marketplace</button></div> : (
          <section className="messages-shell">
            <aside className="messages-list" aria-label="Conversations">
              {conversations.map((conversation) => {
                const lastMessage = conversation.messages.at(-1);
                return <button type="button" key={conversation.id} className={activeConversation?.id === conversation.id ? "active" : ""} onClick={() => navigate(`/messages/${conversation.id}`)}>
                  <ChatAvatar className="messages-user-avatar" user={conversation.otherUser} />
                  <span className="messages-list-copy"><strong>{conversation.otherUser?.name}</strong><small>{conversation.item?.name}</small><em>{lastMessage?.text || "Conversation started"}</em></span>
                  <time>{formatTime(lastMessage?.sentAt || conversation.createdAt)}</time>
                </button>;
              })}
            </aside>

            {status === "not-found" || status === "error" ? <div className="messages-conversation-state"><i className="fa-solid fa-circle-exclamation" /><h2>Conversation unavailable</h2></div> : activeConversation && <article className="messages-conversation">
              <header>
                <ChatAvatar user={activeConversation.otherUser} />
                <div><strong>{activeConversation.otherUser?.name}</strong><span>About {activeConversation.item?.name}</span></div>
                <button type="button" onClick={() => navigate(`/marketplace/items/${activeConversation.item?.id}`)}><img src={activeConversation.item?.image} alt="" /><span>View item</span></button>
              </header>
              <div className="messages-history">
                {activeConversation.messages.length === 0 && <div className="messages-start"><i className="fa-regular fa-hand" /><p>Start the conversation about this piece.</p></div>}
                {activeConversation.messages.map((message) => {
                  const mine = String(message.senderId) === currentUserId;
                  return <div className={`message-bubble-row${mine ? " mine" : ""}`} key={message.id}><div className="message-bubble"><p>{message.text}</p><time>{formatTime(message.sentAt)}</time></div></div>;
                })}
                <div ref={messagesEndRef} />
              </div>
              <form className="messages-composer" onSubmit={sendMessage}>
                <label htmlFor="messageDraft">Message</label>
                <input id="messageDraft" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength="1000" placeholder="Write a message..." autoComplete="off" />
                <button type="submit" disabled={!draft.trim() || sending} aria-label="Send message"><i className="fa-solid fa-paper-plane" /></button>
              </form>
            </article>}
          </section>
        )}
      </main>
    </div>
  );
}
