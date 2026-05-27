import type { VideoGenerationSettings } from "@/lib/image-settings";

export interface MediaState {
  url: string | null;
  loading: boolean;
  originalPrompt: string;
  error: string | null;
  progress: number;
}

export interface CarouselSlideState {
  url: string | null;
  text: string;
  prompt: string;
  error: string | null;
}

export const GENERATION_FAILURE_MESSAGE =
  'Generation failed for some reasons. Please try again or contact "rophenp@gmail.com".';

type ApiErrorResponse = {
  error?: unknown;
  requestId?: unknown;
  details?: unknown;
};

export function createInitialMediaState(): MediaState {
  return {
    url: null,
    loading: false,
    originalPrompt: "",
    error: null,
    progress: 0,
  };
}

export async function logFailedResponse(response: Response, context: string) {
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json().catch(() => null)) as ApiErrorResponse | null)
    : await response.text().catch(() => null);

  console.error(`${context} failed`, {
    status: response.status,
    statusText: response.statusText,
    requestId:
      payload && typeof payload === "object" ? payload.requestId : undefined,
    error: payload && typeof payload === "object" ? payload.error : undefined,
    details: payload && typeof payload === "object" ? payload.details : payload,
  });
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const result = event.target?.result;

      if (typeof result !== "string") {
        reject(new Error("Unable to read file"));
        return;
      }

      resolve(result);
    };

    reader.onerror = () => {
      reject(new Error("Unable to read file"));
    };

    reader.readAsDataURL(file);
  });
}

export function isVideoComplete(status: unknown, progress: number) {
  return status === "completed" || status === "succeeded" || progress >= 100;
}

export function createCarouselSlideTexts(
  count: number,
  existingTexts: string[] = [],
) {
  return Array.from(
    { length: count },
    (_, index) => existingTexts[index] ?? `Slide ${index + 1}: `,
  );
}

export function createCarouselPrompt({
  basePrompt,
  globalStyle,
  slideText,
  slideNumber,
  totalSlides,
}: {
  basePrompt: string;
  globalStyle: string;
  slideText: string;
  slideNumber: number;
  totalSlides: number;
}) {
  return [
    `Carousel topic and context: ${basePrompt}`,
    `Generate exactly one single image for slide ${slideNumber} of ${totalSlides}.`,
    "This image must be one standalone carousel slide only — do not create a collage, storyboard, grid, contact sheet, or multiple slides inside the same image.",
    `The only slide text/content this image must contain is: ${slideText}`,
    `Use this same global visual style across every generated slide: ${globalStyle}`,
    "Keep typography readable, composition clean, and leave balanced margins for social media viewing.",
  ]
    .filter(Boolean)
    .join("\n");
}

function parseFrameSize(size: VideoGenerationSettings["size"]) {
  const [widthValue, heightValue] = size.split("x");
  const width = Number(widthValue);
  const height = Number(heightValue);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Invalid video size: ${size}`);
  }

  return { width, height };
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();

    image.crossOrigin = "anonymous";

    image.onload = () => {
      resolve(image);
    };

    image.onerror = () => {
      reject(new Error("Unable to read source image"));
    };

    image.src = src;
  });
}

export async function normalizeVideoSourceImage(
  sourceUrl: string,
  size: VideoGenerationSettings["size"],
) {
  const { width, height } = parseFrameSize(size);
  const image = await loadImageElement(sourceUrl);
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to prepare source image");
  }

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error("Unable to read source image dimensions");
  }

  const targetAspectRatio = width / height;
  const sourceAspectRatio = sourceWidth / sourceHeight;

  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let cropX = 0;
  let cropY = 0;

  if (sourceAspectRatio > targetAspectRatio) {
    cropWidth = sourceHeight * targetAspectRatio;
    cropX = (sourceWidth - cropWidth) / 2;
  } else if (sourceAspectRatio < targetAspectRatio) {
    cropHeight = sourceWidth / targetAspectRatio;
    cropY = (sourceHeight - cropHeight) / 2;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    width,
    height,
  );

  try {
    return canvas.toDataURL("image/png");
  } catch {
    if (/^https?:\/\//i.test(sourceUrl)) {
      return sourceUrl;
    }

    throw new Error("Unable to prepare source image");
  }
}
