import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
      return NextResponse.json(
        { error: "Failed to retrieve video content URL" },
        { status: response.status },
      );
    }

    const contentData = await response.json();
    return NextResponse.json(contentData);
  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
