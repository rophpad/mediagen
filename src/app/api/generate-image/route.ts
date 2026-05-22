import { NextRequest, NextResponse } from "next/server";

import {
  extractImageUrl,
  getFluxSteps,
  getImageApiUrl,
  isFluxModel,
  parseImageSize,
  readResponseError,
} from "@/lib/image-api";
import { normalizeImageSettings } from "@/lib/image-settings";
import { createLogger, createRequestId, serializeError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const logger = createLogger("api.generate-image", { requestId });

  try {
    const authHeader = request.headers.get("authorization");
    const apiKey = authHeader
      ? authHeader.replace("Bearer ", "").trim()
      : process.env.API_KEY;

    const payload = await request.json();
    const prompt = typeof payload?.prompt === "string" ? payload.prompt : "";
    const image =
      typeof payload?.image === "string" ? payload.image.trim() : "";
    const settings = normalizeImageSettings(payload?.settings ?? payload);

    if (!prompt.trim()) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    const requestBody = isFluxModel(settings.model)
      ? {
          prompt: prompt.trim(),
          ...parseImageSize(settings.size),
          steps: getFluxSteps(),
          ...(image ? { image } : {}),
        }
      : {
          model: settings.model,
          prompt: prompt.trim(),
          size: settings.size,
          quality: settings.quality,
          ...(image ? { image } : {}),
        };
    const response = await fetch(getImageApiUrl("generation", settings.model), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const upstreamError = await readResponseError(response);
      logger.error("Upstream image generation failed", {
        status: response.status,
        statusText: response.statusText,
        model: settings.model,
        size: settings.size,
        quality: settings.quality,
        hasImage: Boolean(image),
        upstreamError,
      });
      return NextResponse.json(
        {
          error: "Failed to generate image",
          requestId,
          details: upstreamError,
        },
        { status: 500 },
      );
    }

    const data = await response.json();
    const imageUrl = extractImageUrl(data);

    if (!imageUrl) {
      logger.error("Image generation response did not include a URL", {
        model: settings.model,
        responseData: data,
      });
      return NextResponse.json(
        { error: "No image URL returned", requestId, details: data },
        { status: 500 },
      );
    }

    return NextResponse.json({
      url: imageUrl,
    });
  } catch (error) {
    logger.error("Image generation route failed", serializeError(error));
    return NextResponse.json(
      {
        error: "Internal server error",
        requestId,
        details: serializeError(error),
      },
      { status: 500 },
    );
  }
}
