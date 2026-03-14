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

    const updated = await updatePost(postId, {
      status: body.status,
      instagramCaption: body.instagramCaption,
      instagramImageUrl: body.instagramImageUrl,
      blogTitle: body.blogTitle,
      blogBodyHtml: body.blogBodyHtml,
      blogSlug: body.blogSlug,
      gbpSummary: body.gbpSummary,
      gbpCallToAction: body.gbpCallToAction,
      approvedAt: body.status === 'approved' ? new Date().toISOString() : undefined,
    });

    return NextResponse.json({ success: true, post: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '投稿の更新に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
