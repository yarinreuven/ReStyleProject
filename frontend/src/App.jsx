import { lazy, Suspense, useLayoutEffect, useMemo } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import SiteFooter from "./components/SiteFooter";
import { useAuth } from "./context/AuthContext";
import closetStyle from "./styles/closet.css?url";
import forgotPasswordStyle from "./styles/forgot-password.css?url";
import homeStyle from "./styles/home.css?url";
import infoPagesStyle from "./styles/info-pages.css?url";
import loginStyle from "./styles/login.css?url";
import marketplaceChatStyle from "./styles/marketplace-chat.css?url";
import marketplaceFavoritesStyle from "./styles/marketplace-favorites.css?url";
import marketplaceItemStyle from "./styles/marketplace-item.css?url";
import marketplaceSellerStyle from "./styles/marketplace-seller.css?url";
import marketplaceStyle from "./styles/marketplace.css?url";
import messagesStyle from "./styles/messages.css?url";
import outfitBuilderStyle from "./styles/outfit-builder.css?url";
import profileStyle from "./styles/profile.css?url";
import registerStyle from "./styles/register.css?url";
import restyleStudioStyle from "./styles/restyle-studio.css?url";
import savedLooksStyle from "./styles/saved-looks.css?url";
import settingsFieldsStyle from "./styles/settings-fields.css?url";
import settingsStyle from "./styles/settings.css?url";

const MarketplaceChat = lazy(() => import("./components/MarketplaceChat"));
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
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Terms = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("./pages/NotFound"));
const chatHiddenPaths = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/about",
  "/contact",
  "/terms"
]);

const publicStyles = new Map([
  ["/", [homeStyle]],
  ["/login", [loginStyle]],
  ["/register", [registerStyle]],
  ["/forgot-password", [forgotPasswordStyle]],
  ["/reset-password", [forgotPasswordStyle]],
  ["/about", [infoPagesStyle]],
  ["/contact", [infoPagesStyle]],
  ["/terms", [infoPagesStyle]]
]);

function stylesForPath(pathname, showChat) {
  let styles = publicStyles.get(pathname);
  if (!styles) {
    if (pathname === "/closet") styles = [closetStyle];
    else if (pathname === "/profile") styles = [profileStyle];
    else if (pathname === "/settings") styles = [settingsStyle, settingsFieldsStyle];
    else if (pathname === "/outfit-builder") styles = [outfitBuilderStyle];
    else if (pathname === "/saved-looks") styles = [savedLooksStyle];
    else if (pathname === "/restyle-studio") styles = [restyleStudioStyle];
    else if (pathname === "/marketplace/favorites") styles = [marketplaceStyle, marketplaceFavoritesStyle];
    else if (pathname.startsWith("/marketplace/items/")) styles = [marketplaceStyle, marketplaceItemStyle];
    else if (pathname.startsWith("/marketplace/sellers/")) styles = [marketplaceStyle, marketplaceSellerStyle];
    else if (pathname === "/marketplace") styles = [marketplaceStyle];
    else if (pathname.startsWith("/messages")) styles = [messagesStyle];
    else styles = [infoPagesStyle];
  }
  return showChat ? [...styles, marketplaceChatStyle] : styles;
}

function RouteStyles() {
  const location = useLocation();
  const { isAuthenticated, isAuthLoading } = useAuth();
  const showChat = !isAuthLoading && isAuthenticated &&
    !chatHiddenPaths.has(location.pathname) &&
    !location.pathname.startsWith("/messages");
  const styles = useMemo(
    () => stylesForPath(location.pathname, showChat),
    [location.pathname, showChat]
  );

  useLayoutEffect(() => {
    const links = styles.map((href) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.routeStyle = "true";
      document.head.appendChild(link);
      return link;
    });
    return () => links.forEach((link) => link.remove());
  }, [styles]);

  return null;
}

function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      Loading page...
    </div>
  );
}

function RealtimeChatLayer() {
  const location = useLocation();
  const { user, token, isAuthenticated, isAuthLoading } = useAuth();

  if (
    isAuthLoading ||
    !isAuthenticated ||
    chatHiddenPaths.has(location.pathname) ||
    location.pathname.startsWith("/messages")
  ) return null;

  return (
    <Suspense fallback={null}>
      <MarketplaceChat
        token={token}
        user={user}
        initialConversationId={new URLSearchParams(location.search).get("chat")}
      />
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <RouteStyles />
      <RealtimeChatLayer />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms" element={<Terms />} />
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <SiteFooter />
    </BrowserRouter>
  );
}

export default App;
