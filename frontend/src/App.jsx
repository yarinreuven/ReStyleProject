import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import MyCloset from "./pages/MyCloset";
import Profile from "./pages/Profile";
import OutfitBuilder from "./pages/OutfitBuilder";
import Marketplace from "./pages/Marketplace";
import MarketplaceItemDetails from "./pages/MarketplaceItemDetails";
import MarketplaceSellerProfile from "./pages/MarketplaceSellerProfile";
import Messages from "./pages/Messages";
import MarketplaceChat from "./components/MarketplaceChat";
import { useAuth } from "./context/AuthContext";

function RealtimeChatLayer() {
  const location = useLocation();
  const { user, token, isAuthenticated, isAuthLoading } = useAuth();
  const publicPaths = ["/login", "/register", "/forgot-password"];

  if (isAuthLoading || !isAuthenticated || publicPaths.includes(location.pathname)) return null;

  return (
    <MarketplaceChat
      token={token}
      user={user}
      initialConversationId={new URLSearchParams(location.search).get("chat")}
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <RealtimeChatLayer />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/closet" element={<MyCloset />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/outfit-builder" element={<OutfitBuilder />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/marketplace/items/:itemId" element={<MarketplaceItemDetails />} />
        <Route path="/marketplace/sellers/:userId" element={<MarketplaceSellerProfile />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/messages/:conversationId" element={<Messages />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
