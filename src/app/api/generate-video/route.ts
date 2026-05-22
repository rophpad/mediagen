import { NextRequest, NextResponse } from "next/server";

import { getImageApiUrl, readResponseError } from "@/lib/image-api";
import { normalizeVideoSettings } from "@/lib/image-settings";
import { createLogger, createRequestId, serializeError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const logger = createLogger("api.generate-video", { requestId });

  try {
    const authHeader = request.headers.get("authorization");
    const apiKey = authHeader
      ? authHeader.replace("Bearer ", "").trim()
      : process.env.API_KEY;

    const payload = await request.json();
    const prompt =
      typeof payload?.prompt === "string" ? payload.prompt.trim() : "";
    const image =
      typeof payload?.image === "string" ? payload.image.trim() : "";
    const settings = normalizeVideoSettings(payload?.settings ?? payload);

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    const response = await fetch(
      getImageApiUrl("video-generation", settings.model),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model,
          prompt,
          size: settings.size,
          seconds: settings.duration,
          ...(image ? { image } : {}),
        }),
      },
    );

    if (!response.ok) {
      const upstreamError = await readResponseError(response);
      logger.error("Upstream video generation failed", {
        status: response.status,
        statusText: response.statusText,
        model: settings.model,
        size: settings.size,
        duration: settings.duration,
        hasImage: Boolean(image),
        upstreamError,
      });
      return NextResponse.json(
        {
          error: "Failed to initiate video generation",
          requestId,
          details: upstreamError,
        },
        { status: 500 },
      );
    }

    const initialData = await response.json();
    return NextResponse.json(initialData); // Returns { id: "video_xyz789", status: "processing" }
  } catch (error) {
    logger.error("Video generation route failed", serializeError(error));
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
