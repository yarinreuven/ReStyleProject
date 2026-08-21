import { memo } from "react";

function MarketplaceItemCard({ item }) {
  const isRental = item.listingType === "RENT";

  return (
    <article className="market-item-card">
      <div className={`market-item-image market-item-image-${item.imageShape}`}>
        <img
          src={item.image}
          alt={item.title}
          loading="lazy"
          decoding="async"
        />
        <span className={`market-item-badge ${isRental ? "rent" : "sale"}`}>
          {item.listingType}
        </span>
        <button
          type="button"
          className="market-heart-button"
          aria-label={`Save ${item.title}`}
          aria-pressed="false"
        >
          <i className="fa-regular fa-heart" aria-hidden="true" />
        </button>
      </div>

      <div className="market-item-content">
        <div className="market-item-heading">
          <h3>{item.title}</h3>
          <p className="market-item-price">
            ₪{item.price}
            {isRental && <span>/ day</span>}
          </p>
        </div>

        <div className="market-item-details">
          <span>Size {item.size}</span>
          <span aria-hidden="true">•</span>
          <span>{item.condition}</span>
        </div>

        <div className="market-item-seller">
          <img src={item.seller.avatar} alt="" loading="lazy" decoding="async" />
          <span>{item.seller.name}</span>
        </div>
      </div>
    </article>
  );
}

export default memo(MarketplaceItemCard);
