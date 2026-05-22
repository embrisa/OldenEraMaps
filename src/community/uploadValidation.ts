import {
  COMMUNITY_UPLOAD_MAX_JSON_BYTES,
  COMMUNITY_UPLOAD_MAX_JSON_DEPTH,
  UploadValidationError,
  deriveUploadMetadata,
  prepareCommunityUploadCore,
  slugify,
  stableStringify,
  type CommunityUploadMetadata,
  type PreparedCommunityUploadCore,
  type UploadMapRequest
} from "./uploadCore";

export {
  COMMUNITY_UPLOAD_MAX_JSON_BYTES,
  COMMUNITY_UPLOAD_MAX_JSON_DEPTH,
  UploadValidationError,
  deriveUploadMetadata,
  slugify,
  stableStringify,
  type CommunityUploadMetadata,
  type UploadMapRequest
};

export interface UploadAuthContext {
  userId: string | null;
}

export interface PreparedCommunityUpload extends PreparedCommunityUploadCore {
  ownerId: string;
}

export interface UploadValidationOptions {
  existingTemplateHashes?: Set<string>;
}

export async function validateAndPrepareCommunityUpload(
  request: UploadMapRequest,
  auth: UploadAuthContext,
  options: UploadValidationOptions = {}
): Promise<PreparedCommunityUpload> {
  if (!auth.userId) {
    throw new UploadValidationError("Sign in before publishing a map template.", "unauthenticated");
  }

  const prepared = await prepareCommunityUploadCore(request);
  if (options.existingTemplateHashes?.has(prepared.templateSha256)) {
    throw new UploadValidationError("You have already uploaded this exact template.", "duplicate_template");
  }

  return {
    ownerId: auth.userId,
    ...prepared
  };
}
