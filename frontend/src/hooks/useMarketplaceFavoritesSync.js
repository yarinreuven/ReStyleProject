import { useEffect } from "react";
import { useDispatch } from "react-redux";

import { useAuth } from "../context/AuthContext";
import {
  clearMarketplaceFavorites,
  fetchMarketplaceFavorites
} from "../store/marketplaceFavoritesSlice.js";

export default function useMarketplaceFavoritesSync() {
  const dispatch = useDispatch();
  const { user, token } = useAuth();
  const userId = user?._id || user?.id;

  useEffect(() => {
    dispatch(clearMarketplaceFavorites());

    if (!token || !userId) {
      return undefined;
    }

    dispatch(fetchMarketplaceFavorites({ token, userId }));

    return () => {
      dispatch(clearMarketplaceFavorites());
    };
  }, [dispatch, token, userId]);
}
