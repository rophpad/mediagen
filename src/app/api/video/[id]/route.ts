import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get("authorization");
    const apiKey = authHeader
      ? authHeader.replace("Bearer ", "").trim()
      : process.env.API_KEY;

    const baseUrl =
      process.env.IMAGE_API_BASE_URL?.replace(/\/$/, "") ||
      "https://build.lewisnote.com";

    const response = await fetch(`${baseUrl}/v1/videos/${params.id}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to get video status" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
