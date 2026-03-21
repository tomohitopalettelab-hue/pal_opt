import { NextRequest, NextResponse } from 'next/server';
import { getPostsByPaletteId } from '../_lib/pal-opt-store';

export async function GET(req: NextRequest) {
  const cid = req.nextUrl.searchParams.get('cid');
  if (!cid) return NextResponse.json({ error: 'cid is required' }, { status: 400 });

  try {
    const posts = await getPostsByPaletteId(cid, 200);

    const published = posts.filter((p) => p.status === 'published').length;
    const draft = posts.filter((p) => p.status === 'draft').length;
    const failed = posts.filter((p) => p.status === 'failed').length;

    const instagramPosts = posts.filter((p) => {
      const platforms = Array.isArray(p.publishedPlatforms) ? p.publishedPlatforms : [];
      return platforms.includes('instagram') || p.instagramPostId;
    }).length;
    const blogPostsOpt = posts.filter((p) => {
      const platforms = Array.isArray(p.publishedPlatforms) ? p.publishedPlatforms : [];
      return platforms.includes('blog') || p.blogPostId;
    }).length;
    const gbpPosts = posts.filter((p) => {
      const platforms = Array.isArray(p.publishedPlatforms) ? p.publishedPlatforms : [];
      return platforms.includes('gbp') || p.gbpPostId;
    }).length;

    const lastPost = posts.find((p) => p.status === 'published');
    const lastActivity = lastPost?.publishedAt || lastPost?.updatedAt || (posts[0]?.updatedAt) || null;
    const daysSince = lastActivity ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000) : 999;

    let health: 'green' | 'yellow' | 'red' = 'green';
    if (daysSince > 14) health = 'red';
    else if (daysSince > 7) health = 'yellow';

    return NextResponse.json({
      service: 'pal_opt',
      serviceName: 'Pal Opt',
      paletteId: cid,
      kpi: {
        totalPosts: posts.length,
        published,
        draft,
        failed,
        instagramPosts,
        blogPostsOpt,
        gbpPosts,
      },
      health,
      lastActivity,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
