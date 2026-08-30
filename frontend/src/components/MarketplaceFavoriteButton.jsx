import { memo } from "react";
import { shallowEqual, useDispatch, useSelector } from "react-redux";

import { useAuth } from "../context/AuthContext";
import {
  addMarketplaceFavorite,
  removeMarketplaceFavorite,
  selectMarketplaceFavoriteButtonState
} from "../store/marketplaceFavoritesSlice.js";

function MarketplaceFavoriteButton({
  item,
  className,
  showLabel = false
}) {
  const dispatch = useDispatch();
  const { token, user } = useAuth();
  const itemId = item?._id || item?.id;
  const userId = String(user?._id || user?.id || "");
  const {
    isSaved: savedInState,
    isPending,
    status: favoritesStatus,
    loadedForUserId
  } = useSelector(
    (state) => selectMarketplaceFavoriteButtonState(state, itemId),
    shallowEqual
  );
  const isSaved = loadedForUserId === userId && savedInState;
  const isDisabled = isPending || favoritesStatus === "loading";

  function toggleFavorite(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!token || !itemId || isDisabled) {
      return;
    }

    if (isSaved) {
      dispatch(removeMarketplaceFavorite({ token, itemId }));
      return;
    }

    dispatch(addMarketplaceFavorite({ token, item }));
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={isSaved
        ? "Remove from marketplace favorites"
        : "Save to marketplace favorites"}
      aria-pressed={isSaved}
      disabled={isDisabled}
      onClick={toggleFavorite}
    >
      <i
        className={`${isSaved ? "fa-solid" : "fa-regular"} fa-heart`}
        aria-hidden="true"
      />
      {showLabel && (isSaved ? "Saved" : "Save item")}
    </button>
  );
}

export default memo(MarketplaceFavoriteButton);
