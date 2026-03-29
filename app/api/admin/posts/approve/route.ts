import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, SESSION_COOKIE_NAME, isExpired } from '../../../../../lib/auth-session';
import { getPostById, updatePost, getSettingsByPaletteId } from '../../../_lib/pal-opt-store';
import { sendNotification } from '../../../_lib/notifications';

type ApproveBody = {
  postId: string;
  action: 'approve' | 'reject';
  reason?: string;
};

/**
 * POST /api/admin/posts/approve
 * 管理者が投稿を承認または却下する
 */
export async function POST(req: Request) {
  try {
    const store = await cookies();
    const value = store.get(SESSION_COOKIE_NAME)?.value;
    const session = parseSessionValue(value);
    if (!session || session.role !== 'admin' || isExpired(session)) {
      return NextResponse.json({ success: false, error: '管理者認証が必要です。' }, { status: 401 });
    }

    const body = (await req.json()) as ApproveBody;
    const postId = String(body.postId || '').trim();
    const action = body.action;
    const reason = String(body.reason || '').trim();

    if (!postId) {
      return NextResponse.json({ success: false, error: '投稿IDが必要です。' }, { status: 400 });
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ success: false, error: 'actionは approve または reject を指定してください。' }, { status: 400 });
    }

    const post = await getPostById(postId);
    if (!post) {
      return NextResponse.json({ success: false, error: '投稿が見つかりません。' }, { status: 404 });
    }

    if (post.status !== 'pending_approval') {
      return NextResponse.json({ success: false, error: 'この投稿は承認待ち状態ではありません。' }, { status: 400 });
    }

    if (action === 'approve') {
      await updatePost(postId, {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvalNote: reason || null,
      });

      // 通知送信
      const settings = await getSettingsByPaletteId(post.paletteId);
      if (settings) {
        await sendNotification(settings, {
          type: 'approved',
          postTitle: post.title,
          postId: post.id,
          paletteId: post.paletteId,
        });
      }

      return NextResponse.json({ success: true, status: 'approved' });
    } else {
      // 却下 → draft に戻す
      await updatePost(postId, {
        status: 'draft',
        approvalNote: reason || '管理者により差し戻されました。',
      });

      // 通知送信
      const settings = await getSettingsByPaletteId(post.paletteId);
      if (settings) {
        await sendNotification(settings, {
          type: 'rejected',
          postTitle: post.title,
          postId: post.id,
          paletteId: post.paletteId,
          reason: reason || undefined,
        });
      }

      return NextResponse.json({ success: true, status: 'rejected' });
    }
  } catch (error: unknown) {
    console.error('--- pal_opt approve エラー ---', error);
    const message = error instanceof Error ? error.message : '承認処理に失敗しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
