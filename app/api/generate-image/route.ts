import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, MAIN_SESSION_COOKIE_NAME, isExpired } from '../../../lib/auth-session';
import { getPostById, updatePost } from '../_lib/pal-opt-store';
import { buildPalDbUrl } from '../_lib/pal-db-client';

/**
 * POST /api/generate-image
 * DALL-E 3 で投稿用画像を生成し、pal_db media に保存する
 */
export async function POST(req: Request) {
  try {
    const store = await cookies();
    const value = store.get(MAIN_SESSION_COOKIE_NAME)?.value;
    const session = parseSessionValue(value);
    if (!session || session.role !== 'customer' || isExpired(session)) {
      return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });
    }

    const apiKey = process.env.OPENAI_KEY_API || process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'OpenAI APIキーが設定されていません。' }, { status: 500 });
    }

    const body = await req.json();
    const postId = String(body.postId || '').trim();
    const topic = String(body.topic || '').trim();
    const keywords: string[] = Array.isArray(body.keywords) ? body.keywords : [];
    const style = String(body.style || 'photorealistic').trim();

    if (!topic && keywords.length === 0) {
      return NextResponse.json({ success: false, error: 'トピックまたはキーワードを入力してください。' }, { status: 400 });
    }

    const paletteId = session.customerId || '';

    // 画像生成プロンプトを構築
    const styleMap: Record<string, string> = {
      photorealistic: 'photorealistic, high quality, professional photography',
      illustration: 'modern flat illustration, clean design, vibrant colors',
      minimal: 'minimalist design, clean white background, simple composition',
      warm: 'warm tones, cozy atmosphere, inviting',
    };
    const styleDesc = styleMap[style] || styleMap.photorealistic;

    const imagePrompt = `Create a social media post image about: ${topic}${keywords.length > 0 ? `. Keywords: ${keywords.join(', ')}` : ''}. Style: ${styleDesc}. No text or words in the image. Square format (1:1 aspect ratio).`;

    const openai = new OpenAI({ apiKey });

    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    const generatedUrl = imageResponse.data?.[0]?.url;
    if (!generatedUrl) {
      return NextResponse.json({ success: false, error: '画像の生成に失敗しました。' }, { status: 500 });
    }

    // DALL-E の一時URLから画像をダウンロードして pal_db media に保存
    let permanentUrl = generatedUrl;
    try {
      const imageData = await fetch(generatedUrl);
      const imageBuffer = Buffer.from(await imageData.arrayBuffer());

      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      formData.append('file', blob, `ai-generated-${Date.now()}.png`);
      formData.append('paletteId', paletteId);

      const uploadUrl = buildPalDbUrl('/api/media');
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (uploadRes.ok) {
        const uploadBody = await uploadRes.json();
        if (uploadBody?.url) {
          permanentUrl = uploadBody.url;
        }
      }
    } catch (uploadError) {
      console.error('画像のpal_dbアップロードに失敗。一時URLを使用:', uploadError);
    }

    // 投稿レコードに画像を追加
    if (postId) {
      const post = await getPostById(postId);
      if (post) {
        const updatedImageUrls = [...post.imageUrls, permanentUrl];
        await updatePost(postId, {
          imageUrls: updatedImageUrls,
          instagramImageUrl: post.instagramImageUrl || permanentUrl,
        });
      }
    }

    return NextResponse.json({
      success: true,
      imageUrl: permanentUrl,
      revisedPrompt: imageResponse.data?.[0]?.revised_prompt || '',
    });
  } catch (error: unknown) {
    console.error('--- pal_opt generate-image エラー ---', error);
    const message = error instanceof Error ? error.message : '画像生成に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
