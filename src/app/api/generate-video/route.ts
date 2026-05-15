import { NextRequest, NextResponse } from "next/server";

import { extractMediaUrl, getImageApiUrl } from "@/lib/image-api";
import { normalizeVideoSettings } from "@/lib/image-settings";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const apiKey = authHeader
      ? authHeader.replace("Bearer ", "").trim()
      : process.env.API_KEY;

    const payload = await request.json();
    const prompt =
      typeof payload?.prompt === "string" ? payload.prompt.trim() : "";
    const settings = normalizeVideoSettings(payload?.settings ?? payload);

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    const baseUrl =
      process.env.IMAGE_API_BASE_URL?.replace(/\/$/, "") ||
      "https://build.lewisnote.com";

    // Step 1: Initiate video generation
    const response = await fetch(`${baseUrl}/v1/videos/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sora-2",
        prompt,
        size: settings.size,
        seconds: Number(settings.duration) || 8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error on create:", errorText);
      return NextResponse.json(
        { error: "Failed to initiate video generation" },
        { status: 500 },
      );
    }

    const initialData = await response.json();
    return NextResponse.json(initialData); // Returns { id: "video_xyz789", status: "processing" }
  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
