import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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

function App() {
  return (
    <BrowserRouter>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
