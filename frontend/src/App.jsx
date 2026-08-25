import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import MarketplaceChat from "./components/MarketplaceChat";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const MyCloset = lazy(() => import("./pages/MyCloset"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const OutfitBuilder = lazy(() => import("./pages/OutfitBuilder"));
const SavedLooks = lazy(() => import("./pages/SavedLooks"));
const ReStyleStudio = lazy(() => import("./pages/ReStyleStudio"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const MarketplaceFavorites = lazy(() => import("./pages/MarketplaceFavorites"));
const MarketplaceItemDetails = lazy(() => import("./pages/MarketplaceItemDetails"));
const MarketplaceSellerProfile = lazy(() => import("./pages/MarketplaceSellerProfile"));
const Messages = lazy(() => import("./pages/Messages"));

function PageLoader() {
  return (
    <div role="status" aria-live="polite">
      Loading page...
    </div>
  );
}

function RealtimeChatLayer() {
  const location = useLocation();
  const { user, token, isAuthenticated, isAuthLoading } = useAuth();
  const publicPaths = ["/login", "/register", "/forgot-password", "/reset-password"];

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
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/closet" element={<MyCloset />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/outfit-builder" element={<OutfitBuilder />} />
            <Route path="/saved-looks" element={<SavedLooks />} />
            <Route path="/restyle-studio" element={<ReStyleStudio />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/marketplace/favorites" element={<MarketplaceFavorites />} />
            <Route path="/marketplace/items/:itemId" element={<MarketplaceItemDetails />} />
            <Route path="/marketplace/sellers/:userId" element={<MarketplaceSellerProfile />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/:conversationId" element={<Messages />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
