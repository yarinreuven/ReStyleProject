import { configureStore } from "@reduxjs/toolkit";

import marketplaceFavoritesReducer from "./marketplaceFavoritesSlice.js";

const store = configureStore({
  reducer: {
    marketplaceFavorites: marketplaceFavoritesReducer
  }
});

export default store;
