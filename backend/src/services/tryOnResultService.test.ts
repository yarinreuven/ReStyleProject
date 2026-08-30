import assert from "node:assert/strict";
import test from "node:test";

import { needsTryOnQuotaCommit } from "./tryOnResultService.ts";

const pendingCommit = {
  _id: "result-id",
  quotaCommitted: false,
  reservationToken: "reservation-token",
  reservationType: "free"
};

test("commits quota only for an uncommitted reserved try-on result", () => {
  assert.equal(needsTryOnQuotaCommit(pendingCommit, false), true);
  assert.equal(needsTryOnQuotaCommit({ ...pendingCommit, quotaCommitted: true }, false), false);
  assert.equal(needsTryOnQuotaCommit({ ...pendingCommit, reservationToken: null }, false), false);
  assert.equal(needsTryOnQuotaCommit({ ...pendingCommit, reservationType: null }, false), false);
  assert.equal(needsTryOnQuotaCommit(pendingCommit, true), false);
});
