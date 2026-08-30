import assert from "node:assert/strict";
import test from "node:test";

import { getTrustedTutorialUrl } from "./trustedTutorialUrl.js";

test("accepts secure YouTube tutorial and search links", () => {
  assert.match(
    getTrustedTutorialUrl("https://www.youtube.com/results?search_query=restyle"),
    /^https:\/\/www\.youtube\.com\//
  );
  assert.equal(
    getTrustedTutorialUrl("https://youtu.be/abc123"),
    "https://youtu.be/abc123"
  );
});

test("rejects insecure and executable URL schemes", () => {
  assert.equal(getTrustedTutorialUrl("http://www.youtube.com/watch?v=abc"), "");
  assert.equal(getTrustedTutorialUrl("javascript:alert(1)"), "");
  assert.equal(getTrustedTutorialUrl("data:text/html,unsafe"), "");
});

test("rejects deceptive or unrelated hosts", () => {
  assert.equal(getTrustedTutorialUrl("https://youtube.com.example.test/watch?v=abc"), "");
  assert.equal(getTrustedTutorialUrl("https://example.test/tutorial"), "");
});

test("rejects credentials and unexpected ports", () => {
  assert.equal(getTrustedTutorialUrl("https://user@youtube.com/watch?v=abc"), "");
  assert.equal(getTrustedTutorialUrl("https://youtube.com:444/watch?v=abc"), "");
});
