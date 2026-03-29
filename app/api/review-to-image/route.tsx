import { ImageResponse } from 'next/og';
import { NextResponse } from 'next/server';
import { buildPalDbUrl } from '../_lib/pal-db-client';

type ReviewToImageRequestBody = {
  reviewText: string;
  rating: number;
  businessName: string;
  reviewerName?: string;
  theme?: 'warm' | 'cool' | 'elegant' | 'modern' | 'natural';
  paletteId: string;
};

type ThemeConfig = {
  bgColor: string;
  bgGradient: string;
  textColor: string;
  accentColor: string;
  starColor: string;
  subtextColor: string;
  cardBg: string;
};

const THEMES: Record<string, ThemeConfig> = {
  warm: {
    bgColor: '#FFF8F0',
    bgGradient: 'linear-gradient(135deg, #FFF8F0 0%, #FFE8D0 100%)',
    textColor: '#3D2B1F',
    accentColor: '#D4845A',
    starColor: '#F5A623',
    subtextColor: '#8B6F5C',
    cardBg: 'rgba(255,255,255,0.85)',
  },
  cool: {
    bgColor: '#F0F4FF',
    bgGradient: 'linear-gradient(135deg, #F0F4FF 0%, #D4E2FF 100%)',
    textColor: '#1A2744',
    accentColor: '#4A7AE5',
    starColor: '#F5A623',
    subtextColor: '#5A6E8A',
    cardBg: 'rgba(255,255,255,0.85)',
  },
  elegant: {
    bgColor: '#1A1A2E',
    bgGradient: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
    textColor: '#F0E6D3',
    accentColor: '#C9A96E',
    starColor: '#FFD700',
    subtextColor: '#B0A090',
    cardBg: 'rgba(255,255,255,0.08)',
  },
  modern: {
    bgColor: '#FAFAFA',
    bgGradient: 'linear-gradient(135deg, #FAFAFA 0%, #F0F0F0 100%)',
    textColor: '#222222',
    accentColor: '#FF6B6B',
    starColor: '#FFB800',
    subtextColor: '#777777',
    cardBg: 'rgba(255,255,255,0.95)',
  },
  natural: {
    bgColor: '#F5F0EB',
    bgGradient: 'linear-gradient(135deg, #F5F0EB 0%, #E8DDD0 100%)',
    textColor: '#2D3B2D',
    accentColor: '#6B8E6B',
    starColor: '#E8B84B',
    subtextColor: '#6B7B6B',
    cardBg: 'rgba(255,255,255,0.80)',
  },
};

/**
 * POST /api/review-to-image
 * レビューを美しい画像（1080x1080）に変換する
 * Next.js の OG Image Generation (Satori) を使用
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReviewToImageRequestBody;
    const { reviewText, rating, businessName, reviewerName, theme: themeKey, paletteId } = body;

    if (!reviewText || !businessName || !paletteId) {
      return NextResponse.json(
        { success: false, error: 'reviewText, businessName, paletteId は必須です。' },
        { status: 400 },
      );
    }

    const t = THEMES[themeKey || 'warm'] || THEMES.warm;
    const stars = Array.from({ length: 5 }, (_, i) => (i < (rating || 5) ? '\u2605' : '\u2606')).join('');

    // レビューテキストが長すぎる場合は省略
    const maxLength = 200;
    const displayText = reviewText.length > maxLength
      ? reviewText.slice(0, maxLength) + '...'
      : reviewText;

    // Satori を使用して JSX -> PNG 画像を生成 (1080x1080)
    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            width: '1080px',
            height: '1080px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: t.bgGradient,
            padding: '80px',
            fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif',
          }}
        >
          {/* 装飾用の引用符 */}
          <div
            style={{
              fontSize: '120px',
              color: t.accentColor,
              opacity: 0.3,
              lineHeight: '1',
              marginBottom: '-20px',
              display: 'flex',
            }}
          >
            {'\u201C'}
          </div>

          {/* カード */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: t.cardBg,
              borderRadius: '24px',
              padding: '60px 50px',
              maxWidth: '880px',
              width: '100%',
              boxShadow: '0 4px 30px rgba(0,0,0,0.08)',
            }}
          >
            {/* 星評価 */}
            <div
              style={{
                fontSize: '48px',
                color: t.starColor,
                letterSpacing: '8px',
                marginBottom: '30px',
                display: 'flex',
              }}
            >
              {stars}
            </div>

            {/* レビューテキスト */}
            <div
              style={{
                fontSize: '32px',
                color: t.textColor,
                textAlign: 'center',
                lineHeight: '1.8',
                marginBottom: '40px',
                display: 'flex',
                maxWidth: '780px',
              }}
            >
              {displayText}
            </div>

            {/* 投稿者名 */}
            {reviewerName && (
              <div
                style={{
                  fontSize: '24px',
                  color: t.subtextColor,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {'--- '}{reviewerName}{' ---'}
              </div>
            )}
          </div>

          {/* ビジネス名 */}
          <div
            style={{
              marginTop: '40px',
              fontSize: '28px',
              color: t.accentColor,
              fontWeight: 'bold',
              display: 'flex',
            }}
          >
            {businessName}
          </div>

          {/* お客様の声ラベル */}
          <div
            style={{
              marginTop: '16px',
              fontSize: '20px',
              color: t.subtextColor,
              display: 'flex',
            }}
          >
            {'\u304A\u5BA2\u69D8\u306E\u58F0'}
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1080,
      },
    );

    // ImageResponse からバイナリを取得
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // pal_db media にアップロードして永続URLを取得
    let permanentUrl = '';
    try {
      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      formData.append('file', blob, `review-card-${Date.now()}.png`);
      formData.append('paletteId', paletteId.trim().toUpperCase());

      const uploadUrl = buildPalDbUrl('/api/media');
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (uploadRes.ok) {
        const uploadBody = await uploadRes.json();
        permanentUrl = (uploadBody as { asset?: { url?: string }; url?: string })?.asset?.url
          || (uploadBody as { url?: string })?.url
          || '';
      }
    } catch (uploadError) {
      console.error('画像のpal_dbアップロードに失敗:', uploadError);
    }

    // アップロード失敗時はBase64 data URLとして返す
    if (!permanentUrl) {
      const base64 = imageBuffer.toString('base64');
      permanentUrl = `data:image/png;base64,${base64}`;
    }

    return NextResponse.json({
      success: true,
      imageUrl: permanentUrl,
    });
  } catch (error: unknown) {
    console.error('--- review-to-image エラー ---', error);
    const message = error instanceof Error ? error.message : '画像生成に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
