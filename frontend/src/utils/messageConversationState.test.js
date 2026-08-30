import assert from "node:assert/strict";
import test from "node:test";

import {
  markConversationReadInList,
  moveConversationToTop
} from "./messageConversationState.js";

test("marks only the opened conversation as read", () => {
  const conversations = [
    { id: "first", unreadCount: 3 },
    { id: "second", unreadCount: 2 }
  ];
  const result = markConversationReadInList(conversations, "second");
  assert.equal(result[0].unreadCount, 3);
  assert.equal(result[1].unreadCount, 0);
  assert.equal(conversations[1].unreadCount, 2);
});

test("moves an updated conversation to the top without duplicates", () => {
  const updated = { id: "second", messages: [{ id: "new-message" }] };
  const result = moveConversationToTop(
    [{ id: "first" }, { id: "second", messages: [] }],
    updated
  );
  assert.deepEqual(result, [updated, { id: "first" }]);
});

test("adds a newly discovered conversation to the top", () => {
  const updated = { id: "new-conversation" };
  assert.deepEqual(
    moveConversationToTop([{ id: "existing" }], updated),
    [updated, { id: "existing" }]
  );
});
