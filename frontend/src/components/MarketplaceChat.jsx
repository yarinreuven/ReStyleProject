import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import usePageStyles from "../hooks/usePageStyles";

const API_URL = "http://localhost:3001/api/messages";
const SOCKET_URL = "http://localhost:3001";

function timeLabel(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" })
    .format(new Date(value));
}

function addMessageOnce(conversation, message) {
  if (!conversation || conversation.messages.some((existing) => String(existing.id) === String(message.id))) {
    return conversation;
  }
  return {
    ...conversation,
    messages: [...conversation.messages, message],
    lastMessageAt: message.sentAt
  };
}

function applyDeletedMessage(conversation, deletedMessage) {
  if (!conversation) return conversation;
  return {
    ...conversation,
    messages: conversation.messages.filter(
      (message) => String(message.id) !== String(deletedMessage.messageId)
    )
  };
}

export default function MarketplaceChat({ token, user, initialConversationId }) {
  usePageStyles("marketplace-chat.css");
  const socketRef = useRef(null);
  const activeIdRef = useRef(initialConversationId || null);
  const openRef = useRef(Boolean(initialConversationId));
  const toastTimerRef = useRef(null);
  const [open, setOpen] = useState(Boolean(initialConversationId));
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState(null);
  const [deletingMessage, setDeletingMessage] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(Date.now());
  const currentUserId = String(user?.id || user?._id || "");
  const requestConfig = useMemo(() => ({
    headers: { Authorization: `Bearer ${token}` }
  }), [token]);

  const loadConversations = useCallback(async () => {
    const { data } = await axios.get(`${API_URL}/conversations`, requestConfig);
    setConversations(data.conversations || []);
    return data.conversations || [];
  }, [requestConfig]);

  const markRead = useCallback(async (conversationId) => {
    try {
      await axios.post(`${API_URL}/conversations/${conversationId}/read`, {}, requestConfig);
      setConversations((current) => current.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
      ));
    } catch {
      // A failed read receipt must not prevent the user from reading the conversation.
    }
  }, [requestConfig]);

  const selectConversation = useCallback(async (conversationId) => {
    try {
      setError("");
      const { data } = await axios.get(`${API_URL}/conversations/${conversationId}`, requestConfig);
      activeIdRef.current = conversationId;
      setActiveConversation(data.conversation);
      setOpen(true);
      openRef.current = true;
      socketRef.current?.emit("conversation:join", conversationId);
      await markRead(conversationId);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not open this conversation.");
    }
  }, [markRead, requestConfig]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadConversations()
      .then(async (list) => {
        if (cancelled) return;
        if (initialConversationId) await selectConversation(initialConversationId);
        else if (list.length === 0) setActiveConversation(null);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.response?.data?.message || "Could not load messages.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [initialConversationId, loadConversations, selectConversation]);

  useEffect(() => {
    if (!token) return undefined;
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"]
    });
    socketRef.current = socket;

    const onConnect = () => {
      setError("");
      loadConversations().catch(() => {});
      if (activeIdRef.current) socket.emit("conversation:join", activeIdRef.current);
    };
    const onNewMessage = async ({ conversationId, message }) => {
      const isMine = String(message.senderId) === currentUserId;
      const isActive = openRef.current && activeIdRef.current === conversationId;

      setActiveConversation((current) =>
        current?.id === conversationId ? addMessageOnce(current, message) : current
      );
      setConversations((current) => current.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;
        const updated = addMessageOnce(conversation, message);
        return {
          ...updated,
          unreadCount: !isMine && !isActive ? (conversation.unreadCount || 0) + 1 : 0
        };
      }));

      if (!isMine && isActive) await markRead(conversationId);
      if (!isMine && !isActive) {
        setToast({ conversationId, name: message.senderName, text: message.text });
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = window.setTimeout(() => setToast(null), 4500);
      }
      await loadConversations();
    };
    const onMessageDeleted = (deletedMessage) => {
      setActiveConversation((current) =>
        current?.id === deletedMessage.conversationId
          ? applyDeletedMessage(current, deletedMessage)
          : current
      );
      setConversations((current) => current.map((conversation) =>
        conversation.id === deletedMessage.conversationId
          ? applyDeletedMessage(conversation, deletedMessage)
          : conversation
      ));
    };

    socket.on("connect", onConnect);
    socket.on("message:new", onNewMessage);
    socket.on("message:deleted", onMessageDeleted);
    socket.on("connect_error", () => setError("Real-time connection was interrupted. Reconnecting..."));
    return () => {
      socket.off("connect", onConnect);
      socket.off("message:new", onNewMessage);
      socket.off("message:deleted", onMessageDeleted);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, [currentUserId, loadConversations, markRead, token]);

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeConversation || sending) return;
    try {
      setSending(true);
      setError("");
      const { data } = await axios.post(
        `${API_URL}/conversations/${activeConversation.id}/messages`,
        { text },
        requestConfig
      );
      setActiveConversation((current) => {
        const savedMessage = data.conversation.messages.at(-1);
        return addMessageOnce(current, savedMessage);
      });
      setConversations((current) => current.map((conversation) =>
        conversation.id === data.conversation.id
          ? { ...data.conversation, unreadCount: 0 }
          : conversation
      ));
      setDraft("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Message failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage() {
    if (!activeConversation || !messageToDelete || deletingMessage) return;
    try {
      setDeletingMessage(true);
      setError("");
      const { data } = await axios.delete(
        `${API_URL}/conversations/${activeConversation.id}/messages/${messageToDelete.id}`,
        requestConfig
      );
      const deletedMessage = {
        conversationId: activeConversation.id,
        messageId: String(data.message.id)
      };
      setActiveConversation((current) => applyDeletedMessage(current, deletedMessage));
      setConversations((current) => current.map((conversation) =>
        conversation.id === activeConversation.id
          ? applyDeletedMessage(conversation, deletedMessage)
          : conversation
      ));
      setMessageToDelete(null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not delete this message.");
    } finally {
      setDeletingMessage(false);
    }
  }

  async function deleteConversation() {
    if (!conversationToDelete || deletingConversation) return;
    try {
      setDeletingConversation(true);
      setError("");
      await axios.delete(
        `${API_URL}/conversations/${conversationToDelete.id}`,
        requestConfig
      );
      setConversations((current) => current.filter(
        (conversation) => conversation.id !== conversationToDelete.id
      ));
      if (activeConversation?.id === conversationToDelete.id) {
        activeIdRef.current = null;
        setActiveConversation(null);
      }
      setConversationToDelete(null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not delete this conversation.");
    } finally {
      setDeletingConversation(false);
    }
  }

  const unreadTotal = conversations.reduce(
    (sum, conversation) => sum + (conversation.unreadCount || 0),
    0
  );

  return <>
    {toast && <button type="button" className="market-chat-toast" onClick={() => { selectConversation(toast.conversationId); setToast(null); }}><i className="fa-regular fa-comment-dots" /><span><strong>New message from {toast.name}</strong><small>{toast.text}</small></span></button>}
    <button type="button" className="market-chat-launcher" onClick={() => setOpen((current) => !current)} aria-label="Open messages">
      <i className="fa-regular fa-comments" />
      {unreadTotal > 0 && <span>{unreadTotal > 99 ? "99+" : unreadTotal}</span>}
    </button>

    {open && <section className="market-chat-panel" aria-label="Marketplace messages">
      <header><div><span>RESTYLE CHAT</span><h2>Messages</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close messages"><i className="fa-solid fa-xmark" /></button></header>
      {error && <p className="market-chat-error">{error}</p>}
      <div className="market-chat-body">
        <aside>
          {loading ? <div className="market-chat-loading">Loading...</div> : conversations.length === 0 ? <div className="market-chat-empty"><i className="fa-regular fa-comments" /><p>No conversations yet.</p></div> : conversations.map((conversation) => {
            const lastMessage = conversation.messages.at(-1);
            return <div key={conversation.id} className={`market-chat-conversation${activeConversation?.id === conversation.id ? " active" : ""}${conversation.unreadCount ? " unread" : ""}`}>
              <button type="button" className="market-chat-conversation-open" onClick={() => selectConversation(conversation.id)}>
                <img src={conversation.otherUser?.avatar || "/images/avatars/fashion-avatar-v2.png"} alt="" />
                <span><strong>{conversation.otherUser?.name}</strong><small>{conversation.item?.name || "Seller conversation"}</small><em>{lastMessage?.text || "Conversation started"}</em></span>
                {conversation.unreadCount > 0 && <b>{conversation.unreadCount}</b>}
              </button>
              <button type="button" className="market-chat-conversation-delete" onClick={() => setConversationToDelete(conversation)} aria-label={`Delete conversation with ${conversation.otherUser?.name || "seller"}`}><i className="fa-regular fa-trash-can" /></button>
            </div>;
          })}
        </aside>

        <article>
          {!activeConversation ? <div className="market-chat-placeholder"><i className="fa-regular fa-message" /><p>Select a conversation</p></div> : <>
            <div className="market-chat-person"><img src={activeConversation.otherUser?.avatar || "/images/avatars/fashion-avatar-v2.png"} alt="" /><span><strong>{activeConversation.otherUser?.name}</strong><small>{activeConversation.item?.name || "Seller conversation"}</small></span></div>
            <div className="market-chat-history">
              {activeConversation.messages.length === 0 && <p className="market-chat-first">{activeConversation.item ? "Start the conversation about this piece." : "Start a conversation with this seller."}</p>}
              {activeConversation.messages.map((message) => {
                const mine = String(message.senderId) === currentUserId;
                const canDelete = mine && !message.deletedAt && now - new Date(message.sentAt).getTime() <= 10 * 60 * 1000;
                return <div key={message.id} className={`market-chat-bubble${mine ? " mine" : ""}${message.deletedAt ? " deleted" : ""}`}><p>{message.text}</p><div className="market-chat-message-meta"><time>{timeLabel(message.sentAt)}</time>{canDelete && <button type="button" onClick={() => setMessageToDelete(message)} aria-label="Delete message"><i className="fa-regular fa-trash-can" /></button>}</div></div>;
              })}
            </div>
            <form onSubmit={sendMessage}><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength="1000" placeholder="Write a message..." aria-label="Message" /><button type="submit" disabled={!draft.trim() || sending}><i className="fa-solid fa-paper-plane" /></button>{sending && <small>Sending...</small>}</form>
          </>}
        </article>
      </div>
      {conversationToDelete && <div className="market-chat-confirm-backdrop" role="presentation">
        <section className="market-chat-confirm" role="alertdialog" aria-modal="true" aria-labelledby="deleteConversationTitle">
          <span><i className="fa-regular fa-trash-can" /></span>
          <h3 id="deleteConversationTitle">Are you sure you want to delete this conversation?</h3>
          <div>
            <button type="button" onClick={() => setConversationToDelete(null)} disabled={deletingConversation}>Cancel</button>
            <button type="button" className="confirm" onClick={deleteConversation} disabled={deletingConversation}>{deletingConversation ? "Deleting..." : "Delete"}</button>
          </div>
        </section>
      </div>}
      {messageToDelete && <div className="market-chat-confirm-backdrop" role="presentation">
        <section className="market-chat-confirm" role="alertdialog" aria-modal="true" aria-labelledby="deleteMessageTitle">
          <span><i className="fa-regular fa-trash-can" /></span>
          <h3 id="deleteMessageTitle">Are you sure you want to delete this message?</h3>
          <p>This message will be deleted for both you and the other person.</p>
          <div>
            <button type="button" onClick={() => setMessageToDelete(null)} disabled={deletingMessage}>Cancel</button>
            <button type="button" className="confirm" onClick={deleteMessage} disabled={deletingMessage}>{deletingMessage ? "Deleting..." : "Delete"}</button>
          </div>
        </section>
      </div>}
    </section>}
  </>;
}
