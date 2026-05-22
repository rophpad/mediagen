import { NextRequest, NextResponse } from "next/server";

import { readResponseError } from "@/lib/image-api";
import { createLogger, createRequestId, serializeError } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = createRequestId();
  const logger = createLogger("api.video-content", { requestId });

  try {
    const resolvedParams = await params;
    const authHeader = request.headers.get("authorization");
    const apiKey = authHeader
      ? authHeader.replace("Bearer ", "").trim()
      : process.env.API_KEY;

    const baseUrl =
      process.env.IMAGE_API_BASE_URL?.replace(/\/$/, "") ||
      "https://build.lewisnote.com";

    const response = await fetch(
      `${baseUrl}/v1/videos/${resolvedParams.id}/content`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    if (!response.ok) {
      const upstreamError = await readResponseError(response);
      logger.error("Upstream video content request failed", {
        status: response.status,
        statusText: response.statusText,
        videoId: resolvedParams.id,
        upstreamError,
      });
      return NextResponse.json(
        {
          error: "Failed to retrieve video content URL",
          requestId,
          details: upstreamError,
        },
        { status: response.status },
      );
    }

    const contentData = await response.json();
    return NextResponse.json(contentData);
  } catch (error) {
    logger.error("Video content route failed", serializeError(error));
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
