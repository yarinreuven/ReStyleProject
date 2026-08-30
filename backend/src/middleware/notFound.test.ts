import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";

import { notFoundHandler } from "./notFound.ts";

test("returns a consistent JSON response for an unknown API route", () => {
  let statusCode = 0;
  let responseBody: unknown;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    }
  } as unknown as Response;

  notFoundHandler(
    { method: "GET", path: "/api/does-not-exist" } as Request,
    response,
    () => undefined
  );

  assert.equal(statusCode, 404);
  assert.deepEqual(responseBody, {
    success: false,
    message: "API route not found",
    method: "GET",
    path: "/api/does-not-exist"
  });
});
