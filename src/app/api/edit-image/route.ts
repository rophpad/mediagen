import { NextRequest, NextResponse } from 'next/server';

import { normalizeImageSettings } from '@/lib/image-settings';

const EDITIONS_ENDPOINT = 'https://build.lewisnote.com/v1/images/edit';

async function fileFromUrl(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Unable to load image source');
  }

  const blob = await response.blob();
  const contentType = response.headers.get('content-type') || blob.type || 'image/png';

  return new File([blob], 'image.png', {
    type: contentType,
  });
}

function extractImageUrl(data: unknown) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const responseData = data as {
    url?: unknown;
    data?: Array<{ url?: unknown }>;
  };

  if (typeof responseData.url === 'string' && responseData.url.trim()) {
    return responseData.url;
  }

  const imageUrl = responseData.data?.[0]?.url;

  return typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl : null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const promptValue = formData.get('prompt');
    const prompt = typeof promptValue === 'string' ? promptValue.trim() : '';

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 },
      );
    }

    const settings = normalizeImageSettings({
      model: formData.get('model'),
      size: formData.get('size'),
      quality: formData.get('quality'),
    });

    const imageValue = formData.get('image');
    const imageUrlValue = formData.get('imageUrl');

    let imageFile: File | null = null;

    if (imageValue instanceof File && imageValue.size > 0) {
      imageFile = imageValue;
    } else if (typeof imageUrlValue === 'string' && imageUrlValue.trim()) {
      imageFile = await fileFromUrl(imageUrlValue.trim());
    }

    if (!imageFile) {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 },
      );
    }

    const upstreamFormData = new FormData();
    upstreamFormData.append('model', settings.model);
    upstreamFormData.append('prompt', prompt);
    upstreamFormData.append('size', settings.size);

    const qualityValue = formData.get('quality');
    if (typeof qualityValue === 'string' && qualityValue.trim()) {
      upstreamFormData.append('quality', settings.quality);
    }

    upstreamFormData.append('image', imageFile, imageFile.name);

    const response = await fetch(EDITIONS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.API_KEY}`,
      },
      body: upstreamFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      return NextResponse.json(
        { error: 'Failed to edit image' },
        { status: 500 },
      );
    }

    const data = await response.json();
    const imageUrl = extractImageUrl(data);

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
