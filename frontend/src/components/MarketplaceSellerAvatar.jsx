export default function MarketplaceSellerAvatar({ seller, className = "" }) {
  if (seller?.avatar) {
    return <img className={className} src={seller.avatar} alt="" loading="lazy" decoding="async" />;
  }

  const initial = seller?.name?.trim().charAt(0).toUpperCase() || "?";
  return <span className={`market-seller-avatar-fallback ${className}`.trim()} aria-hidden="true">{initial}</span>;
}
