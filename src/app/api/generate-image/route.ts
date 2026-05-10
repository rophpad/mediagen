import { NextRequest, NextResponse } from 'next/server';

import { normalizeImageSettings } from '@/lib/image-settings';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const prompt = typeof payload?.prompt === 'string' ? payload.prompt : '';
    const settings = normalizeImageSettings(payload?.settings ?? payload);

    console.log('Payload:', payload);

    if (!prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 },
      );
    }

    const response = await fetch(
      'https://build.lewisnote.com/v1/images/generations',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.API_KEY}`,
        },
        body: JSON.stringify({
          model: settings.model,
          prompt: prompt.trim(),
          size: settings.size,
          quality: settings.quality,
        }),
      },
    );
    console.log('Response:', response)

    if (!response.ok) {
      const error = await response.json();
      console.error('API Error:', error);
      return NextResponse.json(
        { error: 'Failed to generate image' },
        { status: 500 },
      );
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;

    if (!imageUrl) {
      console.error('No image URL in response:', data);
      return NextResponse.json(
        { error: 'No image URL returned' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      url: imageUrl,
    });
  } catch (error) {
    console.error('Server Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
