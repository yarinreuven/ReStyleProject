import express from "express";
import { randomUUID } from "node:crypto";

import {
  generateOutfit,
  getTryOnStatus
} from "../controllers/outfitController.ts";
import {
  deleteSavedOutfit,
  getSavedOutfits,
  saveOutfit
} from "../controllers/savedOutfitController.ts";
import TryOnResult from "../models/TryOnResult.ts";
import {
  authenticateToken,
  type AuthRequest
} from "../middleware/auth.ts";
import { createUserRateLimit } from "../middleware/userRateLimit.ts";
import { tryOnImageUpload } from "../middleware/tryOnUpload.ts";
import { validateTryOnRequest } from "../middleware/validateTryOnRequest.ts";
import { validate, validateParams } from "../middleware/validate.ts";
import {
  createGeminiTryOnImage,
  validateGeminiTryOnImage,
  GeminiTryOnServiceError
} from "../services/geminiTryOnService.ts";
import {
  isNoCostAiMockMode
} from "../services/geminiStylistService.ts";
import {
  existingTryOnAction,
  qualityValidationError,
  type AvatarSource,
} from "../services/tryOnValidationService.ts";
import {
  prepareTryOnGarmentInputs,
  resolveTryOnSelection
} from "../services/tryOnSelectionService.ts";
import {
  resolveTryOnAvatar,
} from "../services/tryOnAvatarService.ts";
import {
  buildTryOnRequestKey,
  finalizeTryOnQuota,
  getTryOnQuotaStatus,
  isLocalTryOnQuotaBypass,
  refundTryOnReservation,
  reserveTryOnQuota,
  TRY_ON_LIMIT_CODE,
  TRY_ON_LIMIT_MESSAGE,
  TRY_ON_RESERVATION_TTL_MS,
  type ReservationType
} from "../services/tryOnQuotaService.ts";
import { resolveSuccessfulTryOnQuota } from "../services/tryOnResultService.ts";
import { buildTryOnSuccessResponse } from "../services/tryOnResponseService.ts";
import {
  outfitRequestSchema,
  savedLookParamsSchema,
  saveOutfitSchema
} from "../validation/outfitValidation.ts";

const router = express.Router();
const generateRateLimit = createUserRateLimit({
  maxRequests: 5,
  windowMs: 10 * 60 * 1000,
  code: "OUTFIT_GENERATE_RATE_LIMITED",
  message: "You are creating looks too quickly. Please wait a few minutes and try again."
});
const tryOnRateLimit = createUserRateLimit({
  maxRequests: 3,
  windowMs: 10 * 60 * 1000,
  code: "TRY_ON_RATE_LIMITED",
  message: "You are creating virtual try-ons too quickly. Please wait a few minutes and try again."
});
router.use(authenticateToken);

router.post(
  "/generate",
  generateRateLimit,
  validate(outfitRequestSchema),
  generateOutfit
);

router.get("/try-on/status", getTryOnStatus);

router.get("/saved", getSavedOutfits);
router.post("/saved", validate(saveOutfitSchema), saveOutfit);
router.delete(
  "/saved/:lookId",
  validateParams(savedLookParamsSchema),
  deleteSavedOutfit
);

router.post(
  "/try-on",
  tryOnRateLimit,
  tryOnImageUpload.single("modelImage"),
  validateTryOnRequest,
  async (req: AuthRequest, res, next) => {
    try {
      const resolvedSelection = await resolveTryOnSelection(
        req.userId,
        req.body.selectionId
      );
      if (!resolvedSelection.success) {
        res.status(resolvedSelection.status).json({
          success: false,
          message: resolvedSelection.message
        });
        return;
      }
      const { selection, selectionItems, items } = resolvedSelection;

      const preparedGarments = await prepareTryOnGarmentInputs(selectionItems, items);
      if (!preparedGarments.success) {
        res.status(preparedGarments.status).json({
          success: false,
          message: preparedGarments.message
        });
        return;
      }
      const { orderedSelectionItems, tryOnInputs, responseItems } = preparedGarments;

      const avatarSource = req.body.avatarSource as AvatarSource;
      const avatar = await resolveTryOnAvatar({
        source: avatarSource,
        file: req.file,
        avatarId: req.body.avatarId,
        userId: req.userId
      });
      if (avatar.error || !avatar.data || !avatar.contentType || !avatar.identity) {
        res.status(avatar.status).json({ success: false, message: avatar.error });
        return;
      }

      const requestKey = buildTryOnRequestKey({
        userId: req.userId,
        selectionId: selection._id.toString(),
        avatarSource,
        avatarIdentity: `garment-lock-v3:${avatar.identity}`
      });
      if (isNoCostAiMockMode()) {
        const quota = await getTryOnQuotaStatus(req.userId);
        if (!quota) throw new Error("TRY_ON_QUOTA_STATUS_NOT_FOUND");
        res.json(buildTryOnSuccessResponse({
          selectionId: selection._id,
          imageData: avatar.data,
          contentType: avatar.contentType,
          items: responseItems,
          quota,
          cached: false
        }));
        return;
      }
      let existing = await TryOnResult.findOne({ requestKey });
      if (existing?.status === "succeeded" && existing.image?.data && existing.image.contentType) {
        const quota = await resolveSuccessfulTryOnQuota(req.userId, existing, requestKey);
        res.json(buildTryOnSuccessResponse({
          selectionId: selection._id,
          imageData: existing.image.data,
          contentType: existing.image.contentType,
          items: responseItems,
          quota,
          cached: true
        }));
        return;
      }
      if (existing?.status === "pending") {
        const updatedAt = existing.updatedAt as Date;
        if (existingTryOnAction(
          "pending",
          updatedAt,
          new Date(),
          TRY_ON_RESERVATION_TTL_MS
        ) === "in-progress") {
          res.status(409).json({
            success: false,
            code: "TRY_ON_ALREADY_IN_PROGRESS",
            message: "This virtual try-on is already being created. Please wait a moment."
          });
          return;
        }
        const stale = await TryOnResult.findOneAndUpdate(
          { _id: existing._id, status: "pending", attemptId: existing.attemptId },
          { $set: { status: "failed", failureCode: "STALE_RESERVATION" } },
          { returnDocument: "after" }
        );
        if (stale?.reservationToken) {
          await refundTryOnReservation(req.userId, stale.reservationToken);
        }
        existing = stale;
      }

      const reservationToken = randomUUID();
      const attemptId = randomUUID();
      const reservation = isLocalTryOnQuotaBypass()
        ? { type: "free" as ReservationType, status: await getTryOnQuotaStatus(req.userId) }
        : await reserveTryOnQuota(req.userId, reservationToken);
      if (!reservation) {
        res.status(403).json({
          success: false,
          code: TRY_ON_LIMIT_CODE,
          message: TRY_ON_LIMIT_MESSAGE
        });
        return;
      }

      try {
        if (existing) {
          const claimed = await TryOnResult.findOneAndUpdate(
            { _id: existing._id, status: "failed" },
            {
              $set: {
                attemptId,
                status: "pending",
                reservationToken,
                reservationType: reservation.type,
                quotaCommitted: false,
                failureCode: null,
                avatarSource,
                avatarIdentity: avatar.identity
              }
            },
            { returnDocument: "after" }
          );
          if (!claimed) throw new Error("TRY_ON_REQUEST_ALREADY_CLAIMED");
        } else {
          await TryOnResult.create({
            owner: req.userId,
            selection: selection._id,
            requestKey,
            attemptId,
            status: "pending",
            reservationToken,
            reservationType: reservation.type,
            avatarSource,
            avatarIdentity: avatar.identity
          });
        }
      } catch (claimError) {
        await refundTryOnReservation(req.userId, reservationToken);
        const raced = await TryOnResult.findOne({ requestKey });
        if (raced?.status === "succeeded" && raced.image?.data && raced.image.contentType) {
          const quota = await resolveSuccessfulTryOnQuota(req.userId, raced, requestKey);
          res.json(buildTryOnSuccessResponse({
            selectionId: selection._id,
            imageData: raced.image.data,
            contentType: raced.image.contentType,
            items: responseItems,
            quota,
            cached: true
          }));
          return;
        }
        res.status(409).json({
          success: false,
          code: "TRY_ON_ALREADY_IN_PROGRESS",
          message: "This virtual try-on is already being created. Please wait a moment."
        });
        return;
      }

      try {
        const generated = await createGeminiTryOnImage(
          avatar.data,
          avatar.contentType,
          tryOnInputs
        );
        console.info(`Gemini try-on image completed with ${generated.model}`);
        const quality = await validateGeminiTryOnImage(
          generated.data,
          generated.contentType,
          avatar.data,
          avatar.contentType,
          tryOnInputs
        );
        const qualityError = qualityValidationError(quality, orderedSelectionItems);
        if (qualityError) throw new Error(`TRY_ON_QUALITY_REJECTED: ${qualityError}`);
        if (generated.data.length > 10 * 1024 * 1024) {
          throw new Error("TRY_ON_IMAGE_TOO_LARGE");
        }
        const saved = await TryOnResult.findOneAndUpdate(
          { requestKey, attemptId, status: "pending" },
          {
            $set: {
              status: "succeeded",
              image: { data: generated.data, contentType: generated.contentType },
              items: responseItems.map((entry) => ({
                item: entry.itemId,
                name: entry.name,
                detectedCategory: entry.detectedCategory
              })),
              validation: quality,
              failureCode: null
            }
          },
          { returnDocument: "after" }
        );
        if (!saved) throw new Error("TRY_ON_RESULT_SAVE_CONFLICT");
        const quota = isLocalTryOnQuotaBypass()
          ? await getTryOnQuotaStatus(req.userId)
          : await finalizeTryOnQuota(
              req.userId,
              reservationToken,
              reservation.type,
              requestKey
            );
        if (!quota) throw new Error("TRY_ON_QUOTA_STATUS_NOT_FOUND");
        await TryOnResult.updateOne(
          { _id: saved._id, quotaCommitted: false },
          { $set: { quotaCommitted: true } }
        );
        res.json(buildTryOnSuccessResponse({
          selectionId: selection._id,
          imageData: generated.data,
          contentType: generated.contentType,
          items: responseItems,
          quota,
          cached: false
        }));
        return;
      } catch (geminiError) {
        const failed = await TryOnResult.findOneAndUpdate(
          { requestKey, attemptId, status: "pending" },
          { $set: { status: "failed", failureCode: "GENERATION_FAILED" } },
          { returnDocument: "after" }
        );
        if (failed) await refundTryOnReservation(req.userId, reservationToken);
        console.error("Gemini try-on request failed", geminiError instanceof GeminiTryOnServiceError
          ? {
              stage: geminiError.stage,
              code: geminiError.code,
              httpStatus: geminiError.httpStatus,
              providerStatus: geminiError.providerStatus
            }
          : {
              stage: "unknown",
              code: geminiError instanceof Error && geminiError.name === "TimeoutError"
                ? "TIMEOUT"
                : "UNEXPECTED_ERROR"
            });
        res.status(502).json({
          success: false,
          message: "The virtual try-on service could not create the fitted image right now. Please try again shortly."
        });
        return;
      }
    } catch (error) {
      next(error);
    }
  }
);

export default router;
