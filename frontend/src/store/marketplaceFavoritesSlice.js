import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

const API_URL = "http://localhost:3001/api/marketplace-favorites";

const initialState = {
  items: [],
  savedItemIds: [],
  status: "idle",
  error: null,
  pendingItemIds: []
};

function getItemId(item) {
  return String(item?._id ?? item?.id ?? "");
}

function getRequestErrorMessage(error) {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.request) {
    return "Could not reach the server. Please try again.";
  }

  return error.message || "Something went wrong. Please try again.";
}

function authorizationConfig(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export const fetchMarketplaceFavorites = createAsyncThunk(
  "marketplaceFavorites/fetchMarketplaceFavorites",
  async (token, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(API_URL, authorizationConfig(token));
      return data.items;
    } catch (error) {
      return rejectWithValue(getRequestErrorMessage(error));
    }
  }
);

export const addMarketplaceFavorite = createAsyncThunk(
  "marketplaceFavorites/addMarketplaceFavorite",
  async ({ token, item }, { rejectWithValue }) => {
    const itemId = getItemId(item);

    try {
      await axios.post(
        `${API_URL}/${itemId}`,
        {},
        authorizationConfig(token)
      );
      return { item, itemId };
    } catch (error) {
      return rejectWithValue({
        itemId,
        message: getRequestErrorMessage(error)
      });
    }
  }
);

export const removeMarketplaceFavorite = createAsyncThunk(
  "marketplaceFavorites/removeMarketplaceFavorite",
  async ({ token, itemId }, { rejectWithValue }) => {
    const normalizedItemId = String(itemId);

    try {
      await axios.delete(
        `${API_URL}/${normalizedItemId}`,
        authorizationConfig(token)
      );
      return normalizedItemId;
    } catch (error) {
      return rejectWithValue({
        itemId: normalizedItemId,
        message: getRequestErrorMessage(error)
      });
    }
  }
);

const marketplaceFavoritesSlice = createSlice({
  name: "marketplaceFavorites",
  initialState,
  reducers: {
    clearMarketplaceFavorites: () => ({ ...initialState })
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMarketplaceFavorites.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchMarketplaceFavorites.fulfilled, (state, action) => {
        state.items = action.payload;
        state.savedItemIds = action.payload.map(getItemId).filter(Boolean);
        state.status = "succeeded";
        state.error = null;
      })
      .addCase(fetchMarketplaceFavorites.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Could not load saved marketplace items.";
      })
      .addCase(addMarketplaceFavorite.pending, (state, action) => {
        const itemId = getItemId(action.meta.arg.item);
        if (itemId && !state.pendingItemIds.includes(itemId)) {
          state.pendingItemIds.push(itemId);
        }
        state.error = null;
      })
      .addCase(addMarketplaceFavorite.fulfilled, (state, action) => {
        const { item, itemId } = action.payload;
        if (!state.savedItemIds.includes(itemId)) {
          state.items.push(item);
          state.savedItemIds.push(itemId);
        }
        state.pendingItemIds = state.pendingItemIds.filter(
          (id) => id !== itemId
        );
      })
      .addCase(addMarketplaceFavorite.rejected, (state, action) => {
        const itemId = action.payload?.itemId || getItemId(action.meta.arg.item);
        state.pendingItemIds = state.pendingItemIds.filter(
          (id) => id !== itemId
        );
        state.error = action.payload?.message ||
          "Could not save this marketplace item.";
      })
      .addCase(removeMarketplaceFavorite.pending, (state, action) => {
        const itemId = String(action.meta.arg.itemId);
        if (!state.pendingItemIds.includes(itemId)) {
          state.pendingItemIds.push(itemId);
        }
        state.error = null;
      })
      .addCase(removeMarketplaceFavorite.fulfilled, (state, action) => {
        const itemId = action.payload;
        state.items = state.items.filter((item) => getItemId(item) !== itemId);
        state.savedItemIds = state.savedItemIds.filter((id) => id !== itemId);
        state.pendingItemIds = state.pendingItemIds.filter(
          (id) => id !== itemId
        );
      })
      .addCase(removeMarketplaceFavorite.rejected, (state, action) => {
        const itemId = action.payload?.itemId || String(action.meta.arg.itemId);
        state.pendingItemIds = state.pendingItemIds.filter(
          (id) => id !== itemId
        );
        state.error = action.payload?.message ||
          "Could not remove this marketplace item.";
      });
  }
});

export const { clearMarketplaceFavorites } = marketplaceFavoritesSlice.actions;

export const selectMarketplaceFavoriteItems = (state) =>
  state.marketplaceFavorites.items;
export const selectMarketplaceFavoritesStatus = (state) =>
  state.marketplaceFavorites.status;
export const selectMarketplaceFavoritesError = (state) =>
  state.marketplaceFavorites.error;
export const selectIsMarketplaceItemSaved = (state, itemId) =>
  state.marketplaceFavorites.savedItemIds.includes(String(itemId));
export const selectIsMarketplaceItemPending = (state, itemId) =>
  state.marketplaceFavorites.pendingItemIds.includes(String(itemId));

export default marketplaceFavoritesSlice.reducer;
