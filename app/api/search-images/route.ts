import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (!query?.trim()) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const apiKey = process.env.UNSPLASH_ACCESS_KEY;

    if (apiKey) {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&orientation=landscape`,
        { headers: { Authorization: `Client-ID ${apiKey}` } },
      );
      if (!res.ok) throw new Error(`Unsplash API Error: ${res.status}`);
      const data = await res.json();
      const images = data.results.map((img: Record<string, unknown>) => {
        const urls = img.urls as Record<string, string>;
        const user = img.user as Record<string, string>;
        return {
          id: img.id,
          url: urls.regular,
          thumb: urls.small,
          alt: (img.alt_description as string) || 'Unsplash Image',
          photographer: user.name,
        };
      });
      return NextResponse.json({ images });
    }

    // フォールバック: Lorem Flickr モック
    const mockImages = Array.from({ length: 9 }).map((_, i) => ({
      id: `mock-${i}`,
      url: `https://loremflickr.com/800/600/${encodeURIComponent(query)}?lock=${i}`,
      thumb: `https://loremflickr.com/400/300/${encodeURIComponent(query)}?lock=${i}`,
      alt: `${query} (フリー素材)`,
      photographer: 'Lorem Flickr',
    }));
    return NextResponse.json({ images: mockImages, isMock: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
