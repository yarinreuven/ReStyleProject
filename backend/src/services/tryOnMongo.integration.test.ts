import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import OutfitSelection from "../models/OutfitSelection.ts";
import TryOnResult from "../models/TryOnResult.ts";
import User from "../models/User.ts";
import {
  finalizeTryOnQuota,
  getTryOnQuotaStatus,
  refundTryOnReservation,
  reserveTryOnQuota
} from "./tryOnQuotaService.ts";

const runMongoIntegration = process.env.RUN_RESTYLE_MONGO_INTEGRATION === "1";
const integrationTest = runMongoIntegration ? test : test.skip;

integrationTest("MongoDB quota reservations and result uniqueness are atomic", async () => {
  const prefix = `codex-part-f-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdSelectionIds: mongoose.Types.ObjectId[] = [];
  const createdResultIds: mongoose.Types.ObjectId[] = [];
  await mongoose.connect("mongodb://127.0.0.1:27017/restyle_codex_part_f_test", {
    serverSelectionTimeoutMS: 3000
  });
  try {
    const users = await User.create([
      { firstName: "Test", lastName: "One", email: `${prefix}-one@example.invalid`, password: "not-a-real-login" },
      { firstName: "Test", lastName: "Two", email: `${prefix}-two@example.invalid`, password: "not-a-real-login" }
    ]);
    createdUserIds.push(...users.map((user) => user._id));
    const [firstUser, secondUser] = users;

    assert.deepEqual(await getTryOnQuotaStatus(firstUser._id.toString()), {
      freeTryOnsUsed: 0,
      freeTryOnsRemaining: 3,
      tryOnCredits: 0,
      subscriptionPlan: "free"
    });
    const parallel = await Promise.all(
      [0, 1, 2, 3].map((index) => reserveTryOnQuota(firstUser._id.toString(), `${prefix}-parallel-${index}`))
    );
    assert.equal(parallel.filter(Boolean).length, 3);
    await Promise.all(parallel.flatMap((reservation, index) => reservation
      ? [refundTryOnReservation(firstUser._id.toString(), `${prefix}-parallel-${index}`)]
      : []));

    for (let index = 1; index <= 3; index += 1) {
      const token = `${prefix}-success-${index}`;
      const reservation = await reserveTryOnQuota(firstUser._id.toString(), token);
      assert.equal(reservation?.type, "free");
      const status = await finalizeTryOnQuota(firstUser._id.toString(), token, "free", `${prefix}-request-${index}`);
      assert.equal(status.freeTryOnsRemaining, 3 - index);
    }
    assert.equal(await reserveTryOnQuota(firstUser._id.toString(), `${prefix}-fourth`), null);
    assert.equal((await getTryOnQuotaStatus(secondUser._id.toString()))?.freeTryOnsRemaining, 3);

    await User.updateOne({ _id: firstUser._id }, { $set: { tryOnCredits: 1 } });
    const creditToken = `${prefix}-credit`;
    assert.equal((await reserveTryOnQuota(firstUser._id.toString(), creditToken))?.type, "credit");
    assert.equal((await getTryOnQuotaStatus(firstUser._id.toString()))?.tryOnCredits, 1);
    assert.equal((await finalizeTryOnQuota(
      firstUser._id.toString(), creditToken, "credit", `${prefix}-credit-request`
    )).tryOnCredits, 0);

    const selection = await OutfitSelection.create({
      user: firstUser._id,
      title: "Integration look",
      explanation: "Mock-only integration selection",
      stylingTips: ["Mock tip"],
      items: [{ item: new mongoose.Types.ObjectId(), detectedCategory: "Dress", reason: "Mock" }]
    });
    createdSelectionIds.push(selection._id);
    assert.equal((await getTryOnQuotaStatus(firstUser._id.toString()))?.freeTryOnsUsed, 3);

    const result = await TryOnResult.create({
      owner: firstUser._id,
      selection: selection._id,
      requestKey: `${prefix}-unique-result`,
      attemptId: `${prefix}-attempt`,
      status: "succeeded",
      avatarSource: "preset",
      avatarIdentity: "female-illustrated",
      image: { data: Buffer.from("mock-image"), contentType: "image/png" },
      items: [{ item: selection.items[0].item, name: "Mock dress", detectedCategory: "Dress" }],
      validation: { valid: true }
    });
    createdResultIds.push(result._id);
    await assert.rejects(() => TryOnResult.create({
      owner: firstUser._id,
      selection: selection._id,
      requestKey: `${prefix}-unique-result`,
      attemptId: `${prefix}-attempt-two`,
      status: "pending",
      avatarSource: "preset",
      avatarIdentity: "female-illustrated"
    }));
  } finally {
    await TryOnResult.deleteMany({ _id: { $in: createdResultIds } });
    await OutfitSelection.deleteMany({ _id: { $in: createdSelectionIds } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await mongoose.disconnect();
  }
});
