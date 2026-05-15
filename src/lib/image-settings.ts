type MediaSettingOption = {
  value: string;
  label: string;
};

type ImageSettingOption = MediaSettingOption;
type VideoSettingOption = MediaSettingOption;

export const IMAGE_MODELS = [
  {
    value: "gpt-image-1.5",
    label: "GPT Image 1.5",
  },
  {
    value: "gpt-image-2",
    label: "GPT Image 2",
  },
  {
    value: "flux-2-klein",
    label: "Flux 2 Klein",
  },
] as const satisfies readonly ImageSettingOption[];

export const IMAGE_SIZES = [
  {
    value: "1024x1024",
    label: "Square",
  },
  {
    value: "1536x1024",
    label: "Landscape",
  },
  {
    value: "1024x1536",
    label: "Portrait",
  },
] as const satisfies readonly ImageSettingOption[];

export const IMAGE_QUALITIES = [
  {
    value: "low",
    label: "Low",
  },
  {
    value: "medium",
    label: "Medium",
  },
  {
    value: "high",
    label: "High",
  },
] as const satisfies readonly ImageSettingOption[];

export const VIDEO_MODELS = [
  {
    value: "video-1",
    label: "Video 1",
  },
  {
    value: "video-1-fast",
    label: "Video 1 Fast",
  },
] as const satisfies readonly VideoSettingOption[];

export const VIDEO_SIZES = [
  {
    value: "1280x720",
    label: "Landscape",
  },
  {
    value: "720x1280",
    label: "Portrait",
  },
  {
    value: "1024x1024",
    label: "Square",
  },
] as const satisfies readonly VideoSettingOption[];

export const VIDEO_DURATIONS = [
  {
    value: "5",
    label: "5 seconds",
  },
  {
    value: "10",
    label: "10 seconds",
  },
] as const satisfies readonly VideoSettingOption[];

export type ImageModel = (typeof IMAGE_MODELS)[number]["value"];
export type ImageSize = (typeof IMAGE_SIZES)[number]["value"];
export type ImageQuality = (typeof IMAGE_QUALITIES)[number]["value"];
export type VideoModel = (typeof VIDEO_MODELS)[number]["value"];
export type VideoSize = (typeof VIDEO_SIZES)[number]["value"];
export type VideoDuration = (typeof VIDEO_DURATIONS)[number]["value"];

export interface ImageGenerationSettings {
  model: ImageModel;
  size: ImageSize;
  quality: ImageQuality;
}

export interface VideoGenerationSettings {
  model: VideoModel;
  size: VideoSize;
  duration: VideoDuration;
}

export const DEFAULT_IMAGE_SETTINGS = {
  model: "gpt-image-2",
  size: "1024x1024",
  quality: "high",
} as const satisfies ImageGenerationSettings;

export const DEFAULT_VIDEO_SETTINGS = {
  model: "video-1",
  size: "1280x720",
  duration: "5",
} as const satisfies VideoGenerationSettings;

function isOptionValue<T extends readonly ImageSettingOption[]>(
  options: T,
  value: unknown,
): value is T[number]["value"] {
  return (
    typeof value === "string" &&
    options.some((option) => option.value === value)
  );
}

export function normalizeImageSettings(
  input: unknown,
): ImageGenerationSettings {
  const candidate = getSettingsCandidate(input);
  const model = candidate.model;
  const size = candidate.size;
  const quality = candidate.quality;

  return {
    model: isOptionValue(IMAGE_MODELS, model)
      ? model
      : DEFAULT_IMAGE_SETTINGS.model,
    size: isOptionValue(IMAGE_SIZES, size) ? size : DEFAULT_IMAGE_SETTINGS.size,
    quality: isOptionValue(IMAGE_QUALITIES, quality)
      ? quality
      : DEFAULT_IMAGE_SETTINGS.quality,
  };
}

export function normalizeVideoSettings(
  input: unknown,
): VideoGenerationSettings {
  const candidate = getSettingsCandidate(input);
  const model = candidate.model;
  const size = candidate.size;
  const duration = candidate.duration;

  return {
    model: isOptionValue(VIDEO_MODELS, model)
      ? model
      : DEFAULT_VIDEO_SETTINGS.model,
    size: isOptionValue(VIDEO_SIZES, size) ? size : DEFAULT_VIDEO_SETTINGS.size,
    duration: isOptionValue(VIDEO_DURATIONS, duration)
      ? duration
      : DEFAULT_VIDEO_SETTINGS.duration,
  };
}

export function getSettingLabel(
  options: readonly MediaSettingOption[],
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function getSettingsCandidate(input: unknown) {
  return input && typeof input === "object"
    ? (input as Record<string, unknown>)
    : {};
}
