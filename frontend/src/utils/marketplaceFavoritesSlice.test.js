import assert from "node:assert/strict";
import test from "node:test";

import reducer, {
  addMarketplaceFavorite,
  fetchMarketplaceFavorites,
  removeMarketplaceFavorite,
  selectIsMarketplaceItemPending,
  selectIsMarketplaceItemSaved
} from "../store/marketplaceFavoritesSlice.js";

function rootState(marketplaceFavorites) {
  return { marketplaceFavorites };
}

test("builds constant-time favorite lookups when favorites load", () => {
  const requestId = "favorites-request";
  const argument = { token: "test-token", userId: "user-1" };
  const items = [{ id: "item-1" }, { _id: "item-2" }];
  let state = reducer(undefined, fetchMarketplaceFavorites.pending(requestId, argument));

  state = reducer(
    state,
    fetchMarketplaceFavorites.fulfilled({ items, userId: "user-1" }, requestId, argument)
  );

  assert.equal(selectIsMarketplaceItemSaved(rootState(state), "item-1"), true);
  assert.equal(selectIsMarketplaceItemSaved(rootState(state), "item-2"), true);
  assert.equal(selectIsMarketplaceItemSaved(rootState(state), "missing"), false);
});

test("keeps saved and pending lookups synchronized while toggling a favorite", () => {
  const item = { id: "item-1", title: "Jacket" };
  const argument = { token: "test-token", item };
  let state = reducer(undefined, addMarketplaceFavorite.pending("add-request", argument));

  assert.equal(selectIsMarketplaceItemPending(rootState(state), item.id), true);

  state = reducer(
    state,
    addMarketplaceFavorite.fulfilled({ item, itemId: item.id }, "add-request", argument)
  );
  assert.equal(selectIsMarketplaceItemPending(rootState(state), item.id), false);
  assert.equal(selectIsMarketplaceItemSaved(rootState(state), item.id), true);

  state = reducer(
    state,
    removeMarketplaceFavorite.fulfilled(item.id, "remove-request", {
      token: "test-token",
      itemId: item.id
    })
  );
  assert.equal(selectIsMarketplaceItemSaved(rootState(state), item.id), false);
});
