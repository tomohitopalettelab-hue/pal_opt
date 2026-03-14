import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, MAIN_SESSION_COOKIE_NAME, isExpired } from '../../../lib/auth-session';
import { getPostById, getPostsByPaletteId, getSettingsByPaletteId, updatePost, type PalOptPost, type PalOptSettings } from '../_lib/pal-opt-store';

type Platform = 'instagram' | 'blog' | 'gbp';

type PublishResult = {
  platform: Platform;
  success: boolean;
  postId?: string;
  error?: string;
};

// ── Instagram (Meta Graph API) ─────────────────────────────────────────────────

const publishToInstagram = async (post: PalOptPost, settings: PalOptSettings): Promise<PublishResult> => {
  const platform: Platform = 'instagram';
  try {
    const { igAccessToken, igBusinessAccountId, instagramCaption, instagramImageUrl } = { ...settings, ...post };
    if (!igAccessToken || !igBusinessAccountId) {
      return { platform, success: false, error: 'Instagram API設定が不足しています。' };
    }
    if (!instagramCaption) {
      return { platform, success: false, error: 'Instagram投稿文がありません。' };
    }

    // Step 1: Create media container
    const containerParams = new URLSearchParams({
      access_token: igAccessToken,
      caption: instagramCaption,
    });

    if (instagramImageUrl) {
      containerParams.set('image_url', instagramImageUrl);
    } else {
      // Feed post requires image; if no image, use text-only approach (not supported by Graph API without image)
      return { platform, success: false, error: 'Instagramへの投稿には画像が必要です。' };
    }

    const containerRes = await fetch(
      `https://graph.facebook.com/v19.0/${igBusinessAccountId}/media`,
      { method: 'POST', body: containerParams },
    );
    const containerBody = await containerRes.json();

    if (!containerRes.ok || !containerBody?.id) {
      return { platform, success: false, error: `メディアコンテナ作成失敗: ${containerBody?.error?.message || 'unknown'}` };
    }

    // Step 2: Publish container
    const publishParams = new URLSearchParams({
      access_token: igAccessToken,
      creation_id: containerBody.id,
    });

    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${igBusinessAccountId}/media_publish`,
      { method: 'POST', body: publishParams },
    );
    const publishBody = await publishRes.json();

    if (!publishRes.ok || !publishBody?.id) {
      return { platform, success: false, error: `Instagram投稿失敗: ${publishBody?.error?.message || 'unknown'}` };
    }

    return { platform, success: true, postId: String(publishBody.id) };
  } catch (error: unknown) {
    return { platform, success: false, error: error instanceof Error ? error.message : 'Instagram投稿エラー' };
  }
};

// ── WordPress / Blog ──────────────────────────────────────────────────────────

const publishToBlog = async (post: PalOptPost, settings: PalOptSettings): Promise<PublishResult> => {
  const platform: Platform = 'blog';
  try {
    if (!post.blogBodyHtml) {
      return { platform, success: false, error: 'ブログ本文がありません。' };
    }

    const { blogUrl, blogWpUsername, blogApiKey } = settings;
    const wantsWp = Boolean(blogUrl && blogWpUsername && blogApiKey);
    const wantsStudio = Boolean(settings.hasPalStudio);
    if (!wantsWp && !wantsStudio) {
      return { platform, success: false, error: 'Blog API設定が不足しています。' };
    }

    const errors: string[] = [];
    let wpPostId: string | undefined;
    let studioPostId: string | undefined;

    if (wantsWp) {
      const wpApiUrl = `${blogUrl!.replace(/\/$/, '')}/wp-json/wp/v2/posts`;
      const credentials = Buffer.from(`${blogWpUsername}:${blogApiKey}`).toString('base64');

      const wpRes = await fetch(wpApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify({
          title: post.blogTitle || post.title,
          content: post.blogBodyHtml,
          slug: post.blogSlug || undefined,
          status: 'publish',
        }),
      });

      const wpBody = await wpRes.json();

      if (!wpRes.ok || !wpBody?.id) {
        errors.push(`WordPress: ${wpBody?.message || 'unknown'}`);
      } else {
        wpPostId = String(wpBody.id);
      }
    }

    if (wantsStudio) {
      const studioResult = await publishToPalStudio(post);
      if (!studioResult.success) {
        errors.push(`pal_studio: ${studioResult.error || 'unknown'}`);
      } else if (studioResult.postId) {
        studioPostId = studioResult.postId;
      }
    }

    if (errors.length > 0) {
      return { platform, success: false, error: `ブログ投稿失敗: ${errors.join(' / ')}` };
    }

    return { platform, success: true, postId: wpPostId || studioPostId };
  } catch (error: unknown) {
    return { platform, success: false, error: error instanceof Error ? error.message : 'ブログ投稿エラー' };
  }
};

const publishToPalStudio = async (post: PalOptPost): Promise<{ success: boolean; postId?: string; error?: string }> => {
  const origin = (process.env.PAL_STUDIO_ORIGIN || process.env.NEXT_PUBLIC_STUDIO_ORIGIN || '').replace(/\/$/, '');
  const apiKey = process.env.PAL_STUDIO_ADMIN_API_KEY || '';

  if (!origin) {
    return { success: false, error: 'pal_studioの接続先が未設定です。' };
  }
  if (!apiKey) {
    return { success: false, error: 'pal_studioのAPIキーが未設定です。' };
  }

  const payload = {
    paletteId: post.paletteId,
    post: {
      id: `palopt-${post.id}`,
      title: post.blogTitle || post.title,
      slug: post.blogSlug || '',
      bodyHtml: post.blogBodyHtml || '',
      excerpt: '',
      status: 'published',
      postType: 'blog',
      tags: Array.isArray(post.keywords) ? post.keywords : [],
      publishedAt: post.publishedAt || new Date().toISOString(),
      imageUrl: post.instagramImageUrl || post.imageUrls?.[0] || '',
    },
  };

  const res = await fetch(`${origin}/api/admin/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-studio-admin-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.success === false) {
    return { success: false, error: body?.error || `pal_studio投稿に失敗しました (${res.status})` };
  }

  const postId = body?.post?.id ? String(body.post.id) : undefined;
  return { success: true, postId };
};

// ── Google Business Profile ───────────────────────────────────────────────────

const publishToGBP = async (post: PalOptPost, settings: PalOptSettings): Promise<PublishResult> => {
  const platform: Platform = 'gbp';
  try {
    const { gbpAccessToken, gbpLocationId } = settings;
    if (!gbpAccessToken || !gbpLocationId) {
      return { platform, success: false, error: 'GBP API設定が不足しています。' };
    }
    if (!post.gbpSummary) {
      return { platform, success: false, error: 'GBP投稿文がありません。' };
    }

    const gbpApiUrl = `https://mybusiness.googleapis.com/v4/${gbpLocationId}/localPosts`;

    const ctaTypes: Record<string, string> = {
      'ウェブサイトを見る': 'LEARN_MORE',
      '電話する': 'CALL',
      '予約する': 'BOOK',
      '詳細を見る': 'LEARN_MORE',
    };
    const ctaActionType = ctaTypes[post.gbpCallToAction || ''] || 'LEARN_MORE';

    const gbpBody: Record<string, unknown> = {
      languageCode: 'ja',
      summary: post.gbpSummary,
      callToAction: {
        actionType: ctaActionType,
      },
      topicType: 'STANDARD',
    };

    if (post.instagramImageUrl) {
      gbpBody.media = [{ mediaFormat: 'PHOTO', sourceUrl: post.instagramImageUrl }];
    }

    const gbpRes = await fetch(gbpApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gbpAccessToken}`,
      },
      body: JSON.stringify(gbpBody),
    });

    const gbpResBody = await gbpRes.json();

    if (!gbpRes.ok || !gbpResBody?.name) {
      return { platform, success: false, error: `GBP投稿失敗: ${gbpResBody?.error?.message || 'unknown'}` };
    }

    return { platform, success: true, postId: String(gbpResBody.name) };
  } catch (error: unknown) {
    return { platform, success: false, error: error instanceof Error ? error.message : 'GBP投稿エラー' };
  }
};

// ── Main Route ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const store = await cookies();
    const value = store.get(MAIN_SESSION_COOKIE_NAME)?.value;
    const session = parseSessionValue(value);
    if (!session || session.role !== 'customer' || isExpired(session)) {
      return NextResponse.json({ success: false, error: '認証が必要です。' }, { status: 401 });
    }

    const paletteId = session.customerId || '';
    const body = await req.json();
    const postId = String(body.postId || '').trim();
    const platforms: Platform[] = Array.isArray(body.platforms) ? body.platforms : ['instagram', 'blog', 'gbp'];

    if (!postId) {
      return NextResponse.json({ success: false, error: '投稿IDが必要です。' }, { status: 400 });
    }

    // Verify ownership
    const allPosts = await getPostsByPaletteId(paletteId);
    const owned = allPosts.find((p) => p.id === postId);
    if (!owned) {
      return NextResponse.json({ success: false, error: '投稿が見つかりません。' }, { status: 404 });
    }

    const post = await getPostById(postId);
    if (!post) {
      return NextResponse.json({ success: false, error: '投稿データの取得に失敗しました。' }, { status: 500 });
    }

    const settings = await getSettingsByPaletteId(paletteId);
    if (!settings) {
      return NextResponse.json({ success: false, error: 'API設定が見つかりません。管理者に連絡してください。' }, { status: 500 });
    }

    // Dispatch all requested platforms in parallel
    const publishFns: Promise<PublishResult>[] = [];
    if (platforms.includes('instagram')) publishFns.push(publishToInstagram(post, settings));
    if (platforms.includes('blog')) publishFns.push(publishToBlog(post, settings));
    if (platforms.includes('gbp')) publishFns.push(publishToGBP(post, settings));

    const settled = await Promise.allSettled(publishFns);
    const results: PublishResult[] = settled.map((r) =>
      r.status === 'fulfilled' ? r.value : { platform: 'instagram' as Platform, success: false, error: String(r.reason) },
    );

    // Update post with publish results
    const publishedPlatforms = [...(post.publishedPlatforms || [])];
    const platformUpdates: Partial<PalOptPost> = {};
    let hasError = false;

    for (const result of results) {
      if (result.success) {
        if (!publishedPlatforms.includes(result.platform)) {
          publishedPlatforms.push(result.platform);
        }
        if (result.platform === 'instagram' && result.postId) platformUpdates.instagramPostId = result.postId;
        if (result.platform === 'blog' && result.postId) platformUpdates.blogPostId = result.postId;
        if (result.platform === 'gbp' && result.postId) platformUpdates.gbpPostId = result.postId;
      } else {
        hasError = true;
      }
    }

    const allDone = platforms.every((p) => publishedPlatforms.includes(p));

    await updatePost(postId, {
      ...platformUpdates,
      publishedPlatforms,
      status: allDone ? 'published' : hasError ? 'failed' : 'approved',
      publishedAt: allDone ? new Date().toISOString() : post.publishedAt,
      errorLog: hasError
        ? results.filter((r) => !r.success).map((r) => `${r.platform}: ${r.error}`).join('\n')
        : null,
    });

    return NextResponse.json({
      success: true,
      results: Object.fromEntries(results.map((r) => [r.platform, r])),
      publishedPlatforms,
    });
  } catch (error: unknown) {
    console.error('--- pal_opt publish error ---', error);
    const message = error instanceof Error ? error.message : '投稿処理中にエラーが発生しました。';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
