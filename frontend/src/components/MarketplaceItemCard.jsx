import { memo } from "react";
import MarketplaceFavoriteButton from "./MarketplaceFavoriteButton";
import MarketplaceSellerAvatar from "./MarketplaceSellerAvatar";

function MarketplaceItemCard({ item, ownerActions, onOpen, onSellerOpen }) {
  const isRental = item.listingType === "RENT";

  return (
    <article
      className="market-item-card"
      role="link"
      tabIndex="0"
      aria-label={`View ${item.title}`}
      onClick={() => onOpen(item.id)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen(item.id);
        }
      }}
    >
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
        {item.availabilityStatus !== "active" && (
          <span className="market-unavailable-badge">UNAVAILABLE</span>
        )}
        <MarketplaceFavoriteButton
          item={item}
          className="market-heart-button"
        />
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

        <button
          type="button"
          className="market-item-seller"
          onClick={(event) => {
            event.stopPropagation();
            onSellerOpen(item.seller.id);
          }}
        >
          <MarketplaceSellerAvatar seller={item.seller} />
          <span>{item.seller.name}</span>
        </button>

        {ownerActions && (
          <div className="market-owner-actions" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => ownerActions.onEdit(item)}>
              <i className="fa-regular fa-pen-to-square" aria-hidden="true" /> Edit
            </button>
            <button type="button" onClick={() => ownerActions.onAvailability(item)}>
              <i className={`fa-regular ${item.availabilityStatus === "active" ? "fa-eye-slash" : "fa-eye"}`} aria-hidden="true" />
              {item.availabilityStatus === "active" ? "Unavailable" : "Make available"}
            </button>
            <button type="button" className="danger" onClick={() => ownerActions.onDelete(item)}>
              <i className="fa-regular fa-trash-can" aria-hidden="true" /> Delete
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default memo(MarketplaceItemCard);
