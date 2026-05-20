import type { ImageSize } from "./image-settings";

export type ImageApiGoal = "generation" | "edit" | "video-generation";

type ImageApiEndpointResolver = string | ((model: string) => string);

const IMAGE_API_ENDPOINT_REGISTRY = {
  generation: (model: string) =>
    isFluxModel(model) ? "v1/images/flux" : "v1/images/generations",
  edit: "v1/images/edits",
  "video-generation": "v1/videos/generations",
} as const satisfies Record<ImageApiGoal, ImageApiEndpointResolver>;

export function isFluxModel(model: string) {
  return model.toLowerCase().startsWith("flux");
}

export function getImageApiUrl(goal: ImageApiGoal, model: string) {
  const baseUrl = process.env.IMAGE_API_BASE_URL;

  if (!baseUrl) {
    throw new Error("IMAGE_API_BASE_URL is required");
  }

  const endpointResolver = IMAGE_API_ENDPOINT_REGISTRY[goal];
  const endpoint =
    typeof endpointResolver === "function"
      ? endpointResolver(model)
      : endpointResolver;

  return new URL(endpoint, normalizeBaseUrl(baseUrl)).toString();
}

export function getFluxSteps() {
  const steps = Number(process.env.IMAGE_API_FLUX_STEPS ?? 25);

  return Number.isFinite(steps) && steps > 0 ? steps : 25;
}

export function extractMediaUrl(data: unknown) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const responseData = data as {
    url?: unknown;
    image_url?: unknown;
    video_url?: unknown;
    data?: Array<{
      url?: unknown;
      image_url?: unknown;
      video_url?: unknown;
    }>;
  };

  const directUrl = firstString(
    responseData.url,
    responseData.image_url,
    responseData.video_url,
  );

  if (directUrl) {
    return directUrl;
  }

  const firstDataItem = responseData.data?.[0];

  return firstString(
    firstDataItem?.url,
    firstDataItem?.image_url,
    firstDataItem?.video_url,
  );
}

export const extractImageUrl = extractMediaUrl;

export function parseImageSize(size: ImageSize) {
  const [width, height] = size.split("x").map((value) => Number(value));

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Invalid image size: ${size}`);
  }

  return { width, height };
}

function firstString(...values: unknown[]) {
  return (
    values.find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    ) ?? null
  );
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
