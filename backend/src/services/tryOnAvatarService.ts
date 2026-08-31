import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp, { type Metadata } from "sharp";

import User from "../models/User.ts";
import { getFrontendUrl } from "./frontendConfigService.ts";
import {
  isApprovedAvatarId,
  uploadedAvatarValidationError,
  type AvatarSource
} from "./tryOnValidationService.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const APPROVED_AVATARS = {
  "female-illustrated": {
    localPath: path.join(projectRoot, "frontend/public/images/avatars/fashion-avatar-v2.png"),
    publicPath: "/images/avatars/fashion-avatar-v2.png"
  },
  "male-illustrated": {
    localPath: path.join(projectRoot, "frontend/public/images/avatars/fashion-avatar-male.png"),
    publicPath: "/images/avatars/fashion-avatar-male.png"
  }
} as const;
const PRESET_AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const presetAvatarCache = new Map<keyof typeof APPROVED_AVATARS, Buffer>();

function isMissingFileError(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export function presetAvatarUrl(
  avatarId: keyof typeof APPROVED_AVATARS,
  frontendUrl = getFrontendUrl()
) {
  return `${frontendUrl.replace(/\/$/, "")}${APPROVED_AVATARS[avatarId].publicPath}`;
}

async function loadPresetAvatar(avatarId: keyof typeof APPROVED_AVATARS) {
  const cached = presetAvatarCache.get(avatarId);
  if (cached) return cached;

  const avatar = APPROVED_AVATARS[avatarId];
  try {
    const localData = await readFile(avatar.localPath);
    presetAvatarCache.set(avatarId, localData);
    return localData;
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
  }

  const response = await fetch(presetAvatarUrl(avatarId), {
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    throw new Error(`Preset avatar request failed (${response.status})`);
  }
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > PRESET_AVATAR_MAX_BYTES) {
    throw new Error("Preset avatar is too large");
  }
  const remoteData = Buffer.from(await response.arrayBuffer());
  if (!remoteData.length || remoteData.length > PRESET_AVATAR_MAX_BYTES) {
    throw new Error("Preset avatar has an invalid size");
  }
  presetAvatarCache.set(avatarId, remoteData);
  return remoteData;
}

interface UploadedAvatarFile {
  buffer: Buffer;
  mimetype: string;
}

export async function preparePersonalModelValidationParts(data: Buffer) {
  const inspectionModelImage = await sharp(data)
    .rotate()
    .resize({ width: 768, height: 1024, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();

  return [
    {
      text: "PERSONAL MODEL PHOTO TO VALIDATE. This is not a wardrobe item. Accept one clear, approximately front-facing person visible from the head through both knees. Lower legs and feet may be outside the frame, and the arms may be in any natural position. A mirror selfie is acceptable when the face remains identifiable and the phone does not substantially hide it. Reject crops above the knees, strongly side-facing poses, groups, or a blurred or heavily obscured person. Ignore the background."
    },
    {
      inline_data: {
        mime_type: "image/jpeg",
        data: inspectionModelImage.toString("base64")
      }
    }
  ];
}

export async function resolvePersonalModelValidationParts(userId: string) {
  const user = await User.findById(userId).select("virtualModelImage");
  if (!user?.virtualModelImage?.data || !user.virtualModelImage.contentType) {
    return {
      success: false as const,
      status: 422,
      code: "VIRTUAL_MODEL_PHOTO_MISSING",
      message: "Upload a clear vertical photo showing one person from head to at least both knees before creating your look."
    };
  }

  const validated = await validateAvatarImage(
    user.virtualModelImage.data,
    user.virtualModelImage.contentType
  );
  if (validated.error) {
    return {
      success: false as const,
      status: 422,
      code: "VIRTUAL_MODEL_PHOTO_UNSUITABLE",
      message: `${validated.error}. Replace your digital model photo before creating a look.`
    };
  }

  return {
    success: true as const,
    parts: await preparePersonalModelValidationParts(user.virtualModelImage.data)
  };
}

export async function validateAvatarImage(
  data: Buffer,
  contentType: string
): Promise<{ error: string; data: Buffer; contentType: string }> {
  let metadata: Metadata;
  try {
    metadata = await sharp(data).metadata();
  } catch {
    return {
      error: "The model photo must be a genuine JPG, PNG or WEBP image",
      data,
      contentType
    };
  }

  const error = uploadedAvatarValidationError({
    declaredMimeType: contentType,
    detectedFormat: metadata.format,
    size: data.length,
    width: metadata.width,
    height: metadata.height
  });

  return { error, data, contentType };
}

export async function resolveTryOnAvatar(input: {
  source: AvatarSource;
  file?: UploadedAvatarFile;
  avatarId?: string;
  userId?: string;
}): Promise<{
  status: number;
  error: string;
  data?: Buffer;
  contentType?: string;
  identity?: string;
}> {
  if (input.source === "preset") {
    if (input.file || !isApprovedAvatarId(input.avatarId)) {
      return { status: 400, error: "Choose an approved illustrated avatar" };
    }
    let data: Buffer;
    try {
      data = await loadPresetAvatar(input.avatarId);
    } catch {
      return {
        status: 503,
        error: "The built-in digital model is temporarily unavailable. Please try again shortly"
      };
    }
    const validated = await validateAvatarImage(data, "image/png");
    return validated.error
      ? { status: 400, error: validated.error }
      : { status: 200, error: "", data, contentType: "image/png", identity: input.avatarId };
  }

  if (input.source === "personal") {
    if (input.file || input.avatarId) {
      return { status: 400, error: "The personal model must come from your saved account image" };
    }
    const user = await User.findById(input.userId).select("virtualModelImage");
    if (!user) return { status: 404, error: "User account not found" };
    if (!user.virtualModelImage?.data || !user.virtualModelImage.contentType) {
      return { status: 404, error: "Your saved digital model photo was not found" };
    }
    const validated = await validateAvatarImage(
      user.virtualModelImage.data,
      user.virtualModelImage.contentType
    );
    return validated.error
      ? { status: 400, error: validated.error }
      : {
          status: 200,
          error: "",
          data: user.virtualModelImage.data,
          contentType: user.virtualModelImage.contentType,
          identity: createHash("sha256").update(user.virtualModelImage.data).digest("hex")
        };
  }

  if (input.source === "upload") {
    if (!input.file?.buffer || input.avatarId) {
      return { status: 400, error: "Choose a clear JPG, PNG or WEBP model photo" };
    }
    const validated = await validateAvatarImage(input.file.buffer, input.file.mimetype);
    return validated.error
      ? { status: 400, error: validated.error }
      : {
          status: 200,
          error: "",
          data: input.file.buffer,
          contentType: input.file.mimetype,
          identity: createHash("sha256").update(input.file.buffer).digest("hex")
        };
  }

  return { status: 400, error: "Choose a valid avatar source" };
}
