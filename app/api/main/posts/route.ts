import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, MAIN_SESSION_COOKIE_NAME, isExpired } from '../../../../lib/auth-session';
import { createPost, getPostsByPaletteId, updatePost } from '../../_lib/pal-opt-store';

const getCustomerSession = async () => {
  const store = await cookies();
  const value = store.get(MAIN_SESSION_COOKIE_NAME)?.value;
  const session = parseSessionValue(value);
  if (!session || session.role !== 'customer' || isExpired(session)) return null;
  return session;
};

export async function GET() {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });
    }

    const posts = await getPostsByPaletteId(session.customerId || '', 20);
    return NextResponse.json({ success: true, posts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '投稿一覧の取得に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });
    }

    const body = await req.json();
    const post = await createPost(session.customerId || '', {
      title: String(body.title || ''),
      topic: String(body.topic || ''),
      keywords: Array.isArray(body.keywords) ? body.keywords : [],
      targetAudience: body.targetAudience || null,
      imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls : [],
    });

    return NextResponse.json({ success: true, post });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '投稿の作成に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });
    }

    const body = await req.json();
    const postId = String(body.id || '').trim();
    if (!postId) {
      return NextResponse.json({ success: false, error: '投稿IDが必要です。' }, { status: 400 });
    }

    const { posts } = { posts: await getPostsByPaletteId(session.customerId || '') };
    const owned = posts.find((p) => p.id === postId);
    if (!owned) {
      return NextResponse.json({ success: false, error: '投稿が見つかりません。' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    // 基本フィールド
    if (body.status !== undefined) updateData.status = body.status;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.topic !== undefined) updateData.topic = body.topic;
    if (body.keywords !== undefined) updateData.keywords = body.keywords;
    if (body.targetAudience !== undefined) updateData.targetAudience = body.targetAudience;
    if (body.imageUrls !== undefined) updateData.imageUrls = body.imageUrls;

    // プラットフォーム別コンテンツ
    if (body.instagramCaption !== undefined) updateData.instagramCaption = body.instagramCaption;
    if (body.instagramImageUrl !== undefined) updateData.instagramImageUrl = body.instagramImageUrl;
    if (body.blogTitle !== undefined) updateData.blogTitle = body.blogTitle;
    if (body.blogBodyHtml !== undefined) updateData.blogBodyHtml = body.blogBodyHtml;
    if (body.blogSlug !== undefined) updateData.blogSlug = body.blogSlug;
    if (body.gbpSummary !== undefined) updateData.gbpSummary = body.gbpSummary;
    if (body.gbpCallToAction !== undefined) updateData.gbpCallToAction = body.gbpCallToAction;
    if (body.gbpImageUrl !== undefined) updateData.gbpImageUrl = body.gbpImageUrl;
    if (body.blogImageUrl !== undefined) updateData.blogImageUrl = body.blogImageUrl;
    if (body.xText !== undefined) updateData.xText = body.xText;
    if (body.xImageUrl !== undefined) updateData.xImageUrl = body.xImageUrl;

    // スケジュール
    if (body.scheduledAt !== undefined) updateData.scheduledAt = body.scheduledAt;

    // 承認
    if (body.approvalNote !== undefined) updateData.approvalNote = body.approvalNote;
    if (body.status === 'approved') updateData.approvedAt = new Date().toISOString();

    const updated = await updatePost(postId, updateData);

    return NextResponse.json({ success: true, post: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '投稿の更新に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
