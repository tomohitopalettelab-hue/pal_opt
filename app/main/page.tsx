"use client";

import { useCallback, useEffect, useState } from 'react';
import {
  Sparkles, Instagram, FileText, Globe, X, Tag, Plus,
  CheckCircle, Clock, AlertCircle, Send, LogOut, ChevronDown,
  ChevronUp, Eye, Loader2, ChevronRight, ArrowLeft, ImageIcon,
  Calendar, Wand2, Hash, LayoutTemplate, Layers,
} from 'lucide-react';
import { MediaModal } from './MediaModal';

// ── Types ─────────────────────────────────────────────────────────────────────

type Post = {
  id: string;
  paletteId?: string;
  title: string;
  topic?: string;
  keywords?: string[];
  targetAudience?: string | null;
  imageUrls?: string[];
  status: string;
  publishedPlatforms: string[];
  instagramCaption?: string | null;
  instagramImageUrl?: string | null;
  blogTitle?: string | null;
  blogBodyHtml?: string | null;
  blogSlug?: string | null;
  blogImageUrl?: string | null;
  gbpSummary?: string | null;
  gbpCallToAction?: string | null;
  gbpImageUrl?: string | null;
  xText?: string | null;
  xImageUrl?: string | null;
  xPostId?: string | null;
  scheduledAt?: string | null;
  templateId?: string | null;
  planId?: string | null;
  variationGroup?: string | null;
  approvalNote?: string | null;
  source?: string;
  sourceType?: string | null;
  errorLog?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt: string;
};

type Template = {
  id: string;
  name: string;
  topic: string;
  tone?: string;
  description?: string;
};

type GeneratedContent = {
  instagram: { caption: string; imageUrl: string | null };
  blog: { title: string; bodyHtml: string; metaDescription: string; slug: string };
  gbp: { summary: string; callToAction: string };
  x?: { text: string };
};

type PlatformPublishState = 'idle' | 'publishing' | 'done' | 'error';

type PublishState = {
  instagram: PlatformPublishState;
  blog: PlatformPublishState;
  gbp: PlatformPublishState;
  x: PlatformPublishState;
};

type AppState = 'login' | 'idle' | 'generating' | 'preview' | 'publishing' | 'detail';

const ACCENT = '#A62183';
const ACCENT_DARK = '#8a1a6d';
const ACCENT_LIGHT = '#f5e6f0';

// ── Login Panel ───────────────────────────────────────────────────────────────

function LoginPanel({ onLogin }: { onLogin: (paletteId: string) => void }) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/main/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || 'ログインに失敗しました。');
        return;
      }
      onLogin(data.paletteId);
    } catch {
      setError('通信エラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F0F4] p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
            <span className="text-white text-sm font-black">PO</span>
          </div>
          <div>
            <p className="text-lg font-black text-slate-800 leading-none">pal opt</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">運用最適化</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-4">ログインして投稿を開始してください</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">ログインID</label>
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none"
              onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${ACCENT}40`)}
              onBlur={(e) => (e.target.style.boxShadow = '')}
              placeholder="login id"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none"
              onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${ACCENT}40`)}
              onBlur={(e) => (e.target.style.boxShadow = '')}
              placeholder="password"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: ACCENT }}
          >
            {isLoading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; color: string }> = {
    draft:            { label: '下書き',     color: 'bg-slate-100 text-slate-500' },
    pending_approval: { label: '承認待ち',   color: 'bg-amber-50 text-amber-700' },
    preview:          { label: 'プレビュー', color: 'bg-blue-50 text-blue-600' },
    approved:         { label: '承認済み',   color: 'bg-yellow-50 text-yellow-700' },
    scheduled:        { label: 'スケジュール済', color: 'bg-blue-50 text-blue-700' },
    publishing:       { label: '投稿中',     color: 'bg-purple-50 text-purple-700' },
    published:        { label: '投稿済み',   color: 'bg-green-50 text-green-700' },
    failed:           { label: 'エラー',     color: 'bg-red-50 text-red-600' },
  };
  const b = map[status] || map.draft;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${b.color}`}>{b.label}</span>;
};

const sourceBadge = (post: Post) => {
  if (post.source === 'pal_base' && post.sourceType) {
    const map: Record<string, string> = { banner: 'バナー', coupon: 'クーポン', flyer: 'チラシ' };
    const label = map[post.sourceType] || post.sourceType;
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700">{label}</span>;
  }
  if (post.source === 'pal_trust') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700">口コミ</span>;
  }
  return null;
};

// ── Post Detail View ───────────────────────────────────────────────────────────

function PostDetailView({ post, onBack, onRefresh }: { post: Post; onBack: () => void; onRefresh?: () => void }) {
  const ACCENT = '#A62183';
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const handleDetailGenerateImage = async () => {
    setIsGeneratingImg(true);
    setActionMsg('');
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, topic: post.topic || post.title, keywords: post.keywords || [] }),
      });
      const data = await res.json();
      if (data.success && data.imageUrl) {
        setActionMsg('画像を追加しました');
        onRefresh?.();
      } else {
        setActionMsg(data.error || '画像生成に失敗しました');
      }
    } catch {
      setActionMsg('画像生成に失敗しました');
    } finally {
      setIsGeneratingImg(false);
    }
  };

  const handleDetailApprovalRequest = async () => {
    setActionMsg('');
    try {
      const res = await fetch('/api/main/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, status: 'pending_approval' }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg('承認申請を送信しました');
        onRefresh?.();
      } else {
        setActionMsg(data.error || '承認申請に失敗しました');
      }
    } catch {
      setActionMsg('承認申請に失敗しました');
    }
  };

  const handleDetailApprove = async () => {
    setActionMsg('');
    try {
      const res = await fetch('/api/main/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, status: 'approved', approvedAt: new Date().toISOString() }),
      });
      if ((await res.json()).success) {
        setActionMsg('承認しました');
        onRefresh?.();
      }
    } catch { /* ignore */ }
  };

  const handleAddMediaToPost = async (url: string) => {
    try {
      const updatedUrls = [...(post.imageUrls || []), url];
      await fetch('/api/main/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, imageUrls: updatedUrls, instagramImageUrl: post.instagramImageUrl || url }),
      });
      setActionMsg('画像を追加しました');
      onRefresh?.();
    } catch { /* ignore */ }
    setShowMediaModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Back button + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-lg hover:bg-white transition-colors border border-slate-200 bg-white shadow-sm"
        >
          <ArrowLeft size={12} />戻る
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-800 truncate">{post.title || '（タイトルなし）'}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {statusBadge(post.status)}
            {sourceBadge(post)}
            {post.scheduledAt && (
              <span className="inline-flex items-center gap-1 text-[10px] text-blue-600">
                <Calendar size={9} />{new Date(post.scheduledAt).toLocaleString('ja-JP')}
              </span>
            )}
            <span className="text-[10px] text-slate-400">
              {post.publishedAt
                ? `投稿: ${new Date(post.publishedAt).toLocaleDateString('ja-JP')}`
                : `更新: ${new Date(post.updatedAt).toLocaleDateString('ja-JP')}`}
            </span>
          </div>
          {post.approvalNote && (
            <p className="text-[10px] text-red-500 mt-0.5">差し戻し: {post.approvalNote}</p>
          )}
        </div>
        <div className="flex gap-1">
          {['instagram','blog','gbp','x'].map((p) => {
            const published = post.publishedPlatforms.includes(p);
            return (
              <span key={p} className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${published ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                {p === 'instagram' ? 'IG' : p === 'blog' ? 'Blog' : p === 'gbp' ? 'GBP' : 'X'}
              </span>
            );
          })}
        </div>
      </div>

      {/* Meta info */}
      {(post.keywords?.length || post.targetAudience) && (
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap gap-3 text-xs">
          {post.keywords?.length ? (
            <div>
              <span className="text-slate-400 font-bold">キーワード：</span>
              {post.keywords.map((k) => (
                <span key={k} className="inline-block ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: '#f5e6f0', color: ACCENT }}>{k}</span>
              ))}
            </div>
          ) : null}
          {post.targetAudience && (
            <div><span className="text-slate-400 font-bold">ターゲット：</span>{post.targetAudience}</div>
          )}
        </div>
      )}

      {/* Content cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Instagram */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor: '#E1306C20' }}>
              <Instagram size={11} style={{ color: '#E1306C' }} />
            </div>
            <p className="text-xs font-bold text-slate-700">Instagram</p>
            {post.publishedPlatforms.includes('instagram') && <CheckCircle size={12} className="ml-auto text-green-500" />}
          </div>
          <div className="p-4 flex-1 overflow-y-auto custom-scrollbar max-h-72">
            {post.instagramImageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={post.instagramImageUrl} alt="" className="w-full aspect-square object-cover rounded-lg mb-3 border border-slate-100" />
            )}
            {post.instagramCaption ? (
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{post.instagramCaption}</p>
            ) : (
              <p className="text-xs text-slate-400 italic">コンテンツなし</p>
            )}
          </div>
        </div>

        {/* Blog */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <div className="w-5 h-5 rounded-md flex items-center justify-center bg-blue-50">
              <FileText size={11} className="text-blue-600" />
            </div>
            <p className="text-xs font-bold text-slate-700">ブログ記事</p>
            {post.publishedPlatforms.includes('blog') && <CheckCircle size={12} className="ml-auto text-green-500" />}
          </div>
          <div className="p-4 flex-1 overflow-y-auto custom-scrollbar max-h-72">
            {post.blogImageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={post.blogImageUrl} alt="" className="w-full aspect-video object-cover rounded-lg mb-3 border border-slate-100" />
            )}
            {post.blogTitle && (
              <p className="text-sm font-black text-slate-800 mb-2 leading-snug">{post.blogTitle}</p>
            )}
            {post.blogSlug && (
              <p className="text-[10px] text-slate-400 mb-2 font-mono">/{post.blogSlug}</p>
            )}
            {post.blogBodyHtml ? (
              <div
                className="text-xs text-slate-600 leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: post.blogBodyHtml }}
              />
            ) : (
              <p className="text-xs text-slate-400 italic">コンテンツなし</p>
            )}
          </div>
        </div>

        {/* GBP */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <div className="w-5 h-5 rounded-md flex items-center justify-center bg-green-50">
              <Globe size={11} className="text-green-600" />
            </div>
            <p className="text-xs font-bold text-slate-700">GBP最新情報</p>
            {post.publishedPlatforms.includes('gbp') && <CheckCircle size={12} className="ml-auto text-green-500" />}
          </div>
          <div className="p-4 flex-1 overflow-y-auto custom-scrollbar max-h-72">
            {post.gbpImageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={post.gbpImageUrl} alt="" className="w-full aspect-video object-cover rounded-lg mb-3 border border-slate-100" />
            )}
            {post.gbpSummary ? (
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{post.gbpSummary}</p>
            ) : (
              <p className="text-xs text-slate-400 italic">コンテンツなし</p>
            )}
            {post.gbpCallToAction && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400">CTA</span>
                <p className="text-xs font-bold text-blue-600 mt-0.5">{post.gbpCallToAction}</p>
              </div>
            )}
          </div>
        </div>

        {/* X (Twitter) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <div className="w-5 h-5 rounded-md flex items-center justify-center bg-slate-100">
              <Hash size={11} className="text-slate-700" />
            </div>
            <p className="text-xs font-bold text-slate-700">X（旧Twitter）</p>
            {post.publishedPlatforms.includes('x') && <CheckCircle size={12} className="ml-auto text-green-500" />}
          </div>
          <div className="p-4 flex-1 overflow-y-auto custom-scrollbar max-h-72">
            {post.xImageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={post.xImageUrl} alt="" className="w-full aspect-video object-cover rounded-lg mb-3 border border-slate-100" />
            )}
            {post.xText ? (
              <>
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{post.xText}</p>
                <p className="text-[10px] text-slate-400 mt-2">{post.xText.length}/280文字</p>
              </>
            ) : (
              <p className="text-xs text-slate-400 italic">コンテンツなし</p>
            )}
          </div>
        </div>
      </div>

      {/* Images */}
      {(post.imageUrls?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
            <ImageIcon size={12} />画像 ({post.imageUrls?.length}枚)
          </p>
          <div className="flex gap-2 flex-wrap">
            {post.imageUrls?.map((url, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={i} src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-100" />
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {post.status !== 'published' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            {(post.status === 'draft' || post.status === 'preview') && (
              <>
                <button
                  onClick={handleDetailApprovalRequest}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border-2 transition-all"
                  style={{ borderColor: '#f59e0b', color: '#b45309' }}
                >
                  <AlertCircle size={12} />承認申請
                </button>
                <button
                  onClick={handleDetailApprove}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-bold transition-all"
                  style={{ backgroundColor: '#16a34a' }}
                >
                  <CheckCircle size={12} />承認
                </button>
              </>
            )}
            <button
              onClick={handleDetailGenerateImage}
              disabled={isGeneratingImg}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              {isGeneratingImg ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              AI画像生成
            </button>
            <button
              onClick={() => setShowMediaModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 transition-all"
            >
              <ImageIcon size={12} />画像を追加
            </button>
          </div>
          {actionMsg && (
            <p className="text-xs mt-2 text-slate-600">{actionMsg}</p>
          )}
        </div>
      )}

      {/* Error log */}
      {post.errorLog && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-bold text-red-700 mb-1 flex items-center gap-1">
            <AlertCircle size={12} />エラーログ
          </p>
          <p className="text-[11px] text-red-600 font-mono whitespace-pre-wrap">{post.errorLog}</p>
        </div>
      )}

      {/* Media Modal */}
      {showMediaModal && (
        <MediaModal
          onSelect={(url: string) => handleAddMediaToPost(url)}
          onClose={() => setShowMediaModal(false)}
        />
      )}
    </div>
  );
}

// ── Preview Card ──────────────────────────────────────────────────────────────

function PreviewCard({
  icon,
  label,
  color,
  publishState,
  onPublish,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  publishState: PlatformPublishState;
  onPublish: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <p className="text-sm font-bold text-slate-700">{label}</p>
        {publishState === 'done' && <CheckCircle size={14} className="ml-auto text-green-500" />}
        {publishState === 'error' && <AlertCircle size={14} className="ml-auto text-red-500" />}
        {publishState === 'publishing' && <Loader2 size={14} className="ml-auto animate-spin text-slate-400" />}
      </div>

      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar max-h-72">
        {children}
      </div>

      <div className="px-4 py-3 border-t border-slate-100">
        <button
          onClick={onPublish}
          disabled={publishState === 'publishing' || publishState === 'done'}
          className="w-full py-2 rounded-lg text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
          style={{ backgroundColor: publishState === 'done' ? '#16a34a' : color }}
        >
          {publishState === 'publishing' ? (
            <><Loader2 size={12} className="animate-spin" />投稿中...</>
          ) : publishState === 'done' ? (
            <><CheckCircle size={12} />投稿済み</>
          ) : (
            <><Send size={12} />投稿する</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MainPage() {
  const [appState, setAppState] = useState<AppState>('login');
  const [paletteId, setPaletteId] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryPost, setSelectedHistoryPost] = useState<Post | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [targetAudience, setTargetAudience] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [tone, setTone] = useState<'professional' | 'casual' | 'friendly'>('professional');
  const [contentLength, setContentLength] = useState<'short' | 'default' | 'long'>('default');

  // Generated content state
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [currentPostId, setCurrentPostId] = useState<string | null>(null);
  const [editedCaption, setEditedCaption] = useState('');
  const [editedBlogTitle, setEditedBlogTitle] = useState('');
  const [editedGbpSummary, setEditedGbpSummary] = useState('');
  const [editedXText, setEditedXText] = useState('');
  const [generateError, setGenerateError] = useState('');
  // 各プラットフォーム画像
  const [igImage, setIgImage] = useState<string | null>(null);
  const [blogImage, setBlogImage] = useState<string | null>(null);
  const [gbpImage, setGbpImage] = useState<string | null>(null);
  const [xImage, setXImage] = useState<string | null>(null);
  const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);

  // Template state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // Monthly plan state
  const [showMonthlyPlan, setShowMonthlyPlan] = useState(false);
  const [planMonth, setPlanMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [planFrequency, setPlanFrequency] = useState<'1x' | '2x' | '3x' | 'daily'>('2x');
  const [planTopics, setPlanTopics] = useState('');
  const [planPosts, setPlanPosts] = useState<Array<{ date: string; title: string; topic: string }>>([]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  // Schedule / approval state
  const [showScheduleInput, setShowScheduleInput] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');

  // AI image generation state
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Publish state
  const [publishState, setPublishState] = useState<PublishState>({
    instagram: 'idle', blog: 'idle', gbp: 'idle', x: 'idle',
  });
  const [isPublishingAll, setIsPublishingAll] = useState(false);

  // Check session on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/main/session');
        const data = await res.json();
        if (data.authenticated) {
          setPaletteId(data.paletteId || '');
          setPosts(data.posts || []);
          setAppState('idle');
        }
      } catch {
        // Not authenticated
      }
    })();
  }, []);

  const handleLogin = (pid: string) => {
    setPaletteId(pid);
    setAppState('idle');
    // Reload posts
    fetch('/api/main/session')
      .then((r) => r.json())
      .then((d) => { if (d.authenticated) setPosts(d.posts || []); });
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.reload();
  };

  const addKeyword = () => {
    const kw = newKeyword.trim();
    if (kw && !keywords.includes(kw)) setKeywords((ks) => [...ks, kw]);
    setNewKeyword('');
  };


  const handleGenerate = useCallback(async () => {
    if (!title.trim() && !topic.trim()) {
      setGenerateError('タイトルまたはトピックを入力してください。');
      return;
    }
    setGenerateError('');
    setAppState('generating');

    try {
      // Create post record first
      const createRes = await fetch('/api/main/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title || topic, topic, keywords, targetAudience, imageUrls }),
      });
      const createData = await createRes.json();
      const postId = createData.post?.id || null;
      setCurrentPostId(postId);

      // Generate content
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, title, topic, keywords, targetAudience, imageUrls, tone, contentLength }),
      });
      const genData = await genRes.json();

      if (!genRes.ok || !genData.success) {
        setGenerateError(genData.error || 'コンテンツ生成に失敗しました。');
        setAppState('idle');
        return;
      }

      setGenerated({
        instagram: genData.instagram,
        blog: genData.blog,
        gbp: genData.gbp,
        x: genData.x || undefined,
      });
      setEditedCaption(genData.instagram.caption || '');
      setEditedBlogTitle(genData.blog.title || '');
      setEditedGbpSummary(genData.gbp.summary || '');
      setEditedXText(genData.x?.text || '');
      // 画像を初期化（共有画像があれば各プラットフォームに設定）
      const firstImage = imageUrls.length > 0 ? imageUrls[0] : genData.instagram?.imageUrl || null;
      setIgImage(firstImage);
      setBlogImage(firstImage);
      setGbpImage(firstImage);
      setXImage(firstImage);
      setPublishState({ instagram: 'idle', blog: 'idle', gbp: 'idle', x: 'idle' });
      setAppState('preview');

      // Refresh posts
      const session = await fetch('/api/main/session').then((r) => r.json());
      if (session.authenticated) setPosts(session.posts || []);
    } catch {
      setGenerateError('生成中にエラーが発生しました。');
      setAppState('idle');
    }
  }, [title, topic, keywords, targetAudience, imageUrls]);

  const publishPlatform = async (platform: 'instagram' | 'blog' | 'gbp' | 'x') => {
    if (!currentPostId) return;

    // Save edits first
    await fetch('/api/main/posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: currentPostId,
        instagramCaption: editedCaption,
        instagramImageUrl: igImage,
        blogTitle: editedBlogTitle,
        blogImageUrl: blogImage,
        gbpSummary: editedGbpSummary,
        gbpImageUrl: gbpImage,
        xText: editedXText,
        xImageUrl: xImage,
      }),
    });

    setPublishState((s) => ({ ...s, [platform]: 'publishing' }));
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: currentPostId, platforms: [platform] }),
      });
      const data = await res.json();
      const result = data.results?.[platform];
      setPublishState((s) => ({
        ...s,
        [platform]: result?.success ? 'done' : 'error',
      }));
    } catch {
      setPublishState((s) => ({ ...s, [platform]: 'error' }));
    }
  };

  const publishAll = async () => {
    if (!currentPostId) return;
    setIsPublishingAll(true);
    setAppState('publishing');

    // Save edits first
    await fetch('/api/main/posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: currentPostId,
        status: 'approved',
        instagramCaption: editedCaption,
        instagramImageUrl: igImage,
        blogTitle: editedBlogTitle,
        blogImageUrl: blogImage,
        gbpSummary: editedGbpSummary,
        gbpImageUrl: gbpImage,
        xText: editedXText,
        xImageUrl: xImage,
      }),
    });

    setPublishState({ instagram: 'publishing', blog: 'publishing', gbp: 'publishing', x: 'publishing' });

    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: currentPostId, platforms: ['instagram', 'blog', 'gbp', 'x'] }),
      });
      const data = await res.json();

      setPublishState({
        instagram: data.results?.instagram?.success ? 'done' : 'error',
        blog: data.results?.blog?.success ? 'done' : 'error',
        gbp: data.results?.gbp?.success ? 'done' : 'error',
        x: data.results?.x?.success ? 'done' : 'error',
      });

      // Refresh posts
      const session = await fetch('/api/main/session').then((r) => r.json());
      if (session.authenticated) setPosts(session.posts || []);
    } catch {
      setPublishState({ instagram: 'error', blog: 'error', gbp: 'error', x: 'error' });
    } finally {
      setIsPublishingAll(false);
      setAppState('preview');
    }
  };

  const resetForm = () => {
    setTitle('');
    setTopic('');
    setKeywords([]);
    setTargetAudience('');
    setImageUrls([]);
    setGenerated(null);
    setCurrentPostId(null);
    setPublishState({ instagram: 'idle', blog: 'idle', gbp: 'idle', x: 'idle' });
    setGenerateError('');
    setTone('professional');
    setContentLength('default');
    setEditedXText('');
    setIgImage(null);
    setBlogImage(null);
    setGbpImage(null);
    setXImage(null);
    setShowScheduleInput(false);
    setScheduledAt('');
    setShowMonthlyPlan(false);
    setAppState('idle');
  };

  // プラットフォーム別画像生成
  const handleGenerateImageFor = async (platform: 'instagram' | 'blog' | 'gbp' | 'x') => {
    if (!currentPostId) return;
    setGeneratingImageFor(platform);
    try {
      const styleMap: Record<string, string> = {
        instagram: 'photorealistic',
        blog: 'minimal',
        gbp: 'warm',
        x: 'illustration',
      };
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: currentPostId, topic: topic || title, keywords, style: styleMap[platform] }),
      });
      const data = await res.json();
      if (data.success && data.imageUrl) {
        const url = data.imageUrl;
        const setter = { instagram: setIgImage, blog: setBlogImage, gbp: setGbpImage, x: setXImage }[platform];
        setter?.(url);
        // DB にも保存
        const fieldMap: Record<string, string> = { instagram: 'instagramImageUrl', blog: 'blogImageUrl', gbp: 'gbpImageUrl', x: 'xImageUrl' };
        await fetch('/api/main/posts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentPostId, [fieldMap[platform]]: url }),
        });
      }
    } catch { /* ignore */ }
    setGeneratingImageFor(null);
  };

  // 全プラットフォーム一括画像生成
  const handleGenerateAllImages = async () => {
    if (!currentPostId) return;
    setGeneratingImageFor('all');
    try {
      const platforms = ['instagram', 'blog', 'gbp', 'x'] as const;
      const styleMap: Record<string, string> = {
        instagram: 'photorealistic',
        blog: 'minimal',
        gbp: 'warm',
        x: 'illustration',
      };
      const results = await Promise.allSettled(
        platforms.map(async (p) => {
          const res = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId: currentPostId, topic: topic || title, keywords, style: styleMap[p] }),
          });
          const data = await res.json();
          return { platform: p, url: data.success ? data.imageUrl : null };
        }),
      );
      const patchData: Record<string, string> = {};
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.url) {
          const { platform, url } = result.value;
          const setter = { instagram: setIgImage, blog: setBlogImage, gbp: setGbpImage, x: setXImage }[platform];
          setter?.(url);
          const fieldMap: Record<string, string> = { instagram: 'instagramImageUrl', blog: 'blogImageUrl', gbp: 'gbpImageUrl', x: 'xImageUrl' };
          patchData[fieldMap[platform]] = url;
        }
      }
      if (Object.keys(patchData).length > 0) {
        await fetch('/api/main/posts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentPostId, ...patchData }),
        });
      }
    } catch { /* ignore */ }
    setGeneratingImageFor(null);
  };

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      const res = await fetch(`/api/templates?paletteId=${paletteId}`);
      const data = await res.json();
      setTemplates(data.templates || []);
      setShowTemplatePicker(true);
    } catch {
      // ignore
    }
  };

  // Apply template
  const applyTemplate = (tpl: Template) => {
    setTopic(tpl.topic || '');
    if (tpl.tone === 'casual') setTone('casual');
    else if (tpl.tone === 'friendly') setTone('friendly');
    else setTone('professional');
    setShowTemplatePicker(false);
  };

  // Generate monthly plan
  const handleGeneratePlan = async () => {
    setIsGeneratingPlan(true);
    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paletteId, month: planMonth, frequency: planFrequency, topics: planTopics }),
      });
      const data = await res.json();
      setPlanPosts(data.posts || []);
    } catch {
      // ignore
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Approve post
  const handleApprove = async (mode: 'now' | 'schedule') => {
    if (!currentPostId) return;
    const body: Record<string, unknown> = { id: currentPostId };
    if (mode === 'schedule' && scheduledAt) {
      body.status = 'scheduled';
      body.scheduledAt = new Date(scheduledAt).toISOString();
    } else {
      body.status = 'approved';
    }
    await fetch('/api/main/posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const session = await fetch('/api/main/session').then((r) => r.json());
    if (session.authenticated) setPosts(session.posts || []);
  };

  // Request approval
  const handleRequestApproval = async () => {
    if (!currentPostId) return;
    await fetch('/api/main/posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentPostId, status: 'pending_approval' }),
    });
    const session = await fetch('/api/main/session').then((r) => r.json());
    if (session.authenticated) setPosts(session.posts || []);
  };

  // Generate AI image
  const handleGenerateImage = async () => {
    if (!currentPostId) return;
    setIsGeneratingImage(true);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: currentPostId, topic: topic || title, keywords }),
      });
      const data = await res.json();
      if (data.success && data.imageUrl) {
        setImageUrls((prev) => [...prev, data.imageUrl]);
        // 投稿レコードにも反映
        await fetch('/api/main/posts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: currentPostId,
            imageUrls: [...imageUrls, data.imageUrl],
            instagramImageUrl: imageUrls.length === 0 ? data.imageUrl : undefined,
          }),
        });
      }
    } catch {
      // ignore
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // ── Login screen ─────────────────────────────────────────────────────────
  if (appState === 'login') {
    return <LoginPanel onLogin={handleLogin} />;
  }

  const allPublished = publishState.instagram === 'done' && publishState.blog === 'done' && publishState.gbp === 'done' && publishState.x === 'done';

  return (
    <>
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F5F0F4]">

      {/* ─── HEADER ────────────────────────────────────────────────────────── */}
      <header className="h-12 bg-white border-b border-slate-200 flex items-center px-4 gap-3 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
            <span className="text-white text-[9px] font-black">PO</span>
          </div>
          <span className="text-sm font-black text-slate-800">pal opt</span>
        </div>
        <span className="text-slate-300">|</span>
        <span className="text-xs text-slate-500 font-mono">{paletteId}</span>
        <div className="ml-auto flex items-center gap-2">
          {(appState === 'preview' || appState === 'detail') && (
            <button
              onClick={() => { setSelectedHistoryPost(null); resetForm(); }}
              className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              新規作成
            </button>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <LogOut size={11} />ログアウト
          </button>
        </div>
      </header>

      {/* ─── BODY ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── LEFT INPUT PANEL ────────────────────────────────────────────── */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs font-bold text-slate-500 mb-3">投稿情報を入力</p>

              {/* Title */}
              <div className="mb-3">
                <label className="block text-[10px] font-bold text-slate-400 mb-1">タイトル / トピック</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例：春の新メニュー開始のお知らせ"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                  onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${ACCENT}30`)}
                  onBlur={(e) => (e.target.style.boxShadow = '')}
                />
              </div>

              {/* Topic detail */}
              <div className="mb-3">
                <label className="block text-[10px] font-bold text-slate-400 mb-1">詳細・内容メモ</label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="伝えたいこと、強調したいポイントなどを自由に記入"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white resize-none"
                />
              </div>

              {/* Keywords */}
              <div className="mb-3">
                <label className="block text-[10px] font-bold text-slate-400 mb-1">
                  <Tag size={9} className="inline mr-1" />キーワード
                </label>
                <div className="flex gap-1.5">
                  <input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                    placeholder="キーワードを追加"
                    className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50"
                  />
                  <button onClick={addKeyword} className="p-1.5 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>
                    <Plus size={12} />
                  </button>
                </div>
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {keywords.map((kw) => (
                      <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: ACCENT_LIGHT, color: ACCENT }}>
                        {kw}
                        <button onClick={() => setKeywords((ks) => ks.filter((k) => k !== kw))}><X size={9} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Target audience */}
              <div className="mb-3">
                <label className="block text-[10px] font-bold text-slate-400 mb-1">ターゲット層</label>
                <input
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="例：30〜40代女性、地域の主婦層"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                />
              </div>

              {/* Image picker */}
              <div className="mb-4">
                <label className="block text-[10px] font-bold text-slate-400 mb-1">
                  <ImageIcon size={9} className="inline mr-1" />画像
                </label>
                <button
                  onClick={() => setShowMediaModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-400 hover:border-slate-300 hover:text-slate-600 transition-colors"
                >
                  <ImageIcon size={12} />メディアを選択・アップロード
                </button>
                {imageUrls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {imageUrls.map((url, i) => (
                      <div key={i} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-slate-200" />
                        <button
                          onClick={() => setImageUrls((urls) => urls.filter((_, idx) => idx !== i))}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center"
                        >
                          <X size={8} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

              {/* Tone selector */}
              <div className="mb-3">
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5">トーン</label>
                <div className="flex gap-1.5">
                  {([
                    { value: 'professional', label: 'プロ' },
                    { value: 'casual',       label: 'カジュアル' },
                    { value: 'friendly',     label: '親しみやすい' },
                  ] as const).map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setTone(value)}
                      className="flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all"
                      style={tone === value
                        ? { backgroundColor: ACCENT, color: '#fff', borderColor: ACCENT }
                        : { backgroundColor: '#fff', color: '#64748b', borderColor: '#e2e8f0' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content length selector */}
              <div className="mb-4">
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5">コンテンツの長さ</label>
                <div className="flex gap-1.5">
                  {([
                    { value: 'short',   label: '短め' },
                    { value: 'default', label: '標準' },
                    { value: 'long',    label: '長め' },
                  ] as const).map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setContentLength(value)}
                      className="flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all"
                      style={contentLength === value
                        ? { backgroundColor: ACCENT, color: '#fff', borderColor: ACCENT }
                        : { backgroundColor: '#fff', color: '#64748b', borderColor: '#e2e8f0' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

            {/* Template and AI image buttons */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={fetchTemplates}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <LayoutTemplate size={12} />テンプレートから作成
              </button>
              <button
                onClick={handleGenerateImage}
                disabled={isGeneratingImage || !currentPostId}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                {isGeneratingImage ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                AI画像生成
              </button>
            </div>

            {/* Template Picker */}
            {showTemplatePicker && templates.length > 0 && (
              <div className="mb-3 bg-white border border-slate-200 rounded-xl shadow-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-slate-500">テンプレート選択</p>
                  <button onClick={() => setShowTemplatePicker(false)} className="text-slate-400 hover:text-slate-600"><X size={12} /></button>
                </div>
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    className="w-full text-left p-2 rounded-lg hover:bg-slate-50 transition-colors border border-slate-100"
                  >
                    <p className="text-xs font-bold text-slate-700">{tpl.name}</p>
                    {tpl.description && <p className="text-[10px] text-slate-400 mt-0.5">{tpl.description}</p>}
                  </button>
                ))}
                {templates.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">テンプレートがありません</p>
                )}
              </div>
            )}

            {generateError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-600">
                {generateError}
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={appState === 'generating'}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-60 transition-all"
              style={{ backgroundColor: ACCENT }}
              onMouseEnter={(e) => { if (appState !== 'generating') (e.currentTarget as HTMLButtonElement).style.backgroundColor = ACCENT_DARK; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = ACCENT; }}
            >
              {appState === 'generating' ? (
                <><Loader2 size={16} className="animate-spin" />生成中...</>
              ) : (
                <><Sparkles size={16} />コンテンツ生成</>
              )}
            </button>
          </div>

          {/* Monthly Plan */}
          <div className="border-t border-slate-100">
            <button
              onClick={() => setShowMonthlyPlan((v) => !v)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-500 hover:text-slate-800"
            >
              <Layers size={11} />
              月間計画
              {showMonthlyPlan ? <ChevronUp size={11} className="ml-auto" /> : <ChevronDown size={11} className="ml-auto" />}
            </button>
            {showMonthlyPlan && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">対象月</label>
                  <input
                    type="month"
                    value={planMonth}
                    onChange={(e) => setPlanMonth(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">投稿頻度</label>
                  <div className="flex gap-1">
                    {([
                      { value: '1x', label: '週1回' },
                      { value: '2x', label: '週2回' },
                      { value: '3x', label: '週3回' },
                      { value: 'daily', label: '毎日' },
                    ] as const).map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setPlanFrequency(value)}
                        className="flex-1 py-1 rounded text-[10px] font-bold border transition-all"
                        style={planFrequency === value
                          ? { backgroundColor: ACCENT, color: '#fff', borderColor: ACCENT }
                          : { backgroundColor: '#fff', color: '#64748b', borderColor: '#e2e8f0' }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">トピック・テーマ</label>
                  <textarea
                    value={planTopics}
                    onChange={(e) => setPlanTopics(e.target.value)}
                    placeholder="投稿したいテーマを入力（カンマ区切り）"
                    rows={2}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 resize-none"
                  />
                </div>
                <button
                  onClick={handleGeneratePlan}
                  disabled={isGeneratingPlan}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-white text-xs font-bold disabled:opacity-60 transition-all"
                  style={{ backgroundColor: ACCENT }}
                >
                  {isGeneratingPlan ? <><Loader2 size={12} className="animate-spin" />生成中...</> : <><Calendar size={12} />計画を生成</>}
                </button>
                {planPosts.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                    {planPosts.map((p, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
                        <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">{p.date}</span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-700 truncate">{p.title}</p>
                          <p className="text-[10px] text-slate-400 truncate">{p.topic}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* History */}
          {posts.length > 0 && (
            <div className="border-t border-slate-100">
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-500 hover:text-slate-800"
              >
                <Clock size={11} />
                投稿履歴 ({posts.length}件)
                {showHistory ? <ChevronUp size={11} className="ml-auto" /> : <ChevronDown size={11} className="ml-auto" />}
              </button>
              {showHistory && (
                <div className="px-3 pb-3 space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {posts.map((post) => {
                    const isSelected = selectedHistoryPost?.id === post.id;
                    return (
                      <button
                        key={post.id}
                        onClick={() => { setSelectedHistoryPost(post); setAppState('detail'); }}
                        className="w-full bg-slate-50 rounded-lg p-2.5 text-left transition-colors hover:bg-slate-100 flex items-center gap-2"
                        style={isSelected ? { backgroundColor: '#f5e6f0', outline: `1.5px solid ${ACCENT}40` } : {}}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate">{post.title || '（タイトルなし）'}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[9px] text-slate-400">{new Date(post.updatedAt).toLocaleDateString('ja-JP')}</span>
                            {sourceBadge(post)}
                            {post.publishedPlatforms.map((p) => (
                              <span key={p} className="text-[9px] bg-green-50 text-green-700 px-1 py-0.5 rounded font-bold">
                                {p === 'instagram' ? 'IG' : p === 'blog' ? 'Blog' : p === 'gbp' ? 'GBP' : 'X'}
                              </span>
                            ))}
                            {post.status === 'failed' && (
                              <span className="text-[9px] bg-red-50 text-red-600 px-1 py-0.5 rounded font-bold">Error</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={12} className="text-slate-300 flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── RIGHT PREVIEW PANEL ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {appState === 'idle' && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: ACCENT_LIGHT }}>
                <Sparkles size={28} style={{ color: ACCENT }} />
              </div>
              <p className="text-sm font-bold">コンテンツ生成を開始</p>
              <p className="text-xs mt-1 text-center max-w-xs">
                左のフォームにタイトルやキーワードを入力して<br />「コンテンツ生成」ボタンを押してください
              </p>
            </div>
          )}

          {appState === 'detail' && selectedHistoryPost && (
            <PostDetailView
              post={selectedHistoryPost}
              onBack={() => { setSelectedHistoryPost(null); setAppState('idle'); }}
              onRefresh={async () => {
                const session = await fetch('/api/main/session').then((r) => r.json());
                if (session.authenticated) {
                  setPosts(session.posts || []);
                  const updated = (session.posts || []).find((p: Post) => p.id === selectedHistoryPost.id);
                  if (updated) setSelectedHistoryPost(updated);
                }
              }}
            />
          )}

          {appState === 'generating' && (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 size={36} className="animate-spin mb-4" style={{ color: ACCENT }} />
              <p className="text-sm font-bold text-slate-600">4プラットフォームのコンテンツを生成中...</p>
              <p className="text-xs text-slate-400 mt-1">しばらくお待ちください</p>
            </div>
          )}

          {(appState === 'preview' || appState === 'publishing') && generated && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye size={14} style={{ color: ACCENT }} />
                  <p className="text-sm font-bold text-slate-700">プレビュー・投稿</p>
                </div>
                {allPublished && (
                  <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                    <CheckCircle size={12} />すべて投稿完了
                  </span>
                )}
              </div>

              {/* 一括画像生成ボタン */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateAllImages}
                  disabled={generatingImageFor !== null}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-50"
                  style={{ backgroundColor: ACCENT }}
                >
                  {generatingImageFor === 'all' ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  全SNS画像を一括生成
                </button>
                <span className="text-[10px] text-slate-400">各プラットフォームに最適な画像をAIで生成します</span>
              </div>

              {/* Platform preview cards */}
              <div className="grid grid-cols-4 gap-4">
                {/* Instagram */}
                <PreviewCard
                  icon={<Instagram size={13} />}
                  label="Instagram"
                  color="#E1306C"
                  publishState={publishState.instagram}
                  onPublish={() => publishPlatform('instagram')}
                >
                  {igImage && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={igImage} alt="" className="w-full aspect-square object-cover rounded-lg mb-2 border border-slate-100" />
                  )}
                  <button
                    onClick={() => handleGenerateImageFor('instagram')}
                    disabled={generatingImageFor !== null}
                    className="w-full flex items-center justify-center gap-1 py-1.5 mb-2 rounded-md text-[10px] font-bold border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {generatingImageFor === 'instagram' ? <Loader2 size={10} className="animate-spin" /> : <ImageIcon size={10} />}
                    {igImage ? '画像を再生成' : '画像を生成'}
                  </button>
                  <textarea
                    value={editedCaption}
                    onChange={(e) => setEditedCaption(e.target.value)}
                    className="w-full text-xs text-slate-700 leading-relaxed resize-none outline-none border-0 bg-transparent"
                    rows={6}
                  />
                </PreviewCard>

                {/* Blog */}
                <PreviewCard
                  icon={<FileText size={13} />}
                  label="ブログ記事"
                  color="#2563eb"
                  publishState={publishState.blog}
                  onPublish={() => publishPlatform('blog')}
                >
                  {blogImage && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={blogImage} alt="" className="w-full aspect-video object-cover rounded-lg mb-2 border border-slate-100" />
                  )}
                  <button
                    onClick={() => handleGenerateImageFor('blog')}
                    disabled={generatingImageFor !== null}
                    className="w-full flex items-center justify-center gap-1 py-1.5 mb-2 rounded-md text-[10px] font-bold border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {generatingImageFor === 'blog' ? <Loader2 size={10} className="animate-spin" /> : <ImageIcon size={10} />}
                    {blogImage ? '画像を再生成' : '画像を生成'}
                  </button>
                  <input
                    value={editedBlogTitle}
                    onChange={(e) => setEditedBlogTitle(e.target.value)}
                    className="w-full text-sm font-bold text-slate-800 border-0 outline-none bg-transparent mb-2 leading-snug"
                  />
                  <div
                    className="text-xs text-slate-600 leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: generated.blog.bodyHtml }}
                  />
                </PreviewCard>

                {/* GBP */}
                <PreviewCard
                  icon={<Globe size={13} />}
                  label="GBP最新情報"
                  color="#16a34a"
                  publishState={publishState.gbp}
                  onPublish={() => publishPlatform('gbp')}
                >
                  {gbpImage && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={gbpImage} alt="" className="w-full aspect-video object-cover rounded-lg mb-2 border border-slate-100" />
                  )}
                  <button
                    onClick={() => handleGenerateImageFor('gbp')}
                    disabled={generatingImageFor !== null}
                    className="w-full flex items-center justify-center gap-1 py-1.5 mb-2 rounded-md text-[10px] font-bold border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {generatingImageFor === 'gbp' ? <Loader2 size={10} className="animate-spin" /> : <ImageIcon size={10} />}
                    {gbpImage ? '画像を再生成' : '画像を生成'}
                  </button>
                  <textarea
                    value={editedGbpSummary}
                    onChange={(e) => setEditedGbpSummary(e.target.value)}
                    className="w-full text-xs text-slate-700 leading-relaxed resize-none outline-none border-0 bg-transparent"
                    rows={8}
                  />
                  {generated.gbp.callToAction && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400">CTA</span>
                      <p className="text-xs font-bold text-blue-600 mt-0.5">{generated.gbp.callToAction}</p>
                    </div>
                  )}
                </PreviewCard>

                {/* X (Twitter) */}
                <PreviewCard
                  icon={<Hash size={13} />}
                  label="X（旧Twitter）"
                  color="#000000"
                  publishState={publishState.x}
                  onPublish={() => publishPlatform('x')}
                >
                  {xImage && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={xImage} alt="" className="w-full aspect-video object-cover rounded-lg mb-2 border border-slate-100" />
                  )}
                  <button
                    onClick={() => handleGenerateImageFor('x')}
                    disabled={generatingImageFor !== null}
                    className="w-full flex items-center justify-center gap-1 py-1.5 mb-2 rounded-md text-[10px] font-bold border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {generatingImageFor === 'x' ? <Loader2 size={10} className="animate-spin" /> : <ImageIcon size={10} />}
                    {xImage ? '画像を再生成' : '画像を生成'}
                  </button>
                  <textarea
                    value={editedXText}
                    onChange={(e) => setEditedXText(e.target.value)}
                    className="w-full text-xs text-slate-700 leading-relaxed resize-none outline-none border-0 bg-transparent"
                    rows={6}
                    maxLength={280}
                  />
                  <p className={`text-[10px] mt-1 font-bold ${editedXText.length > 280 ? 'text-red-500' : 'text-slate-400'}`}>
                    {editedXText.length}/280文字
                  </p>
                </PreviewCard>
              </div>

              {/* Approval / Schedule actions */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRequestApproval}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border-2 transition-all"
                    style={{ borderColor: '#f59e0b', color: '#b45309' }}
                  >
                    <AlertCircle size={12} />承認申請
                  </button>
                  <button
                    onClick={() => handleApprove('now')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-bold transition-all"
                    style={{ backgroundColor: '#16a34a' }}
                  >
                    <CheckCircle size={12} />今すぐ承認
                  </button>
                  <button
                    onClick={() => setShowScheduleInput((v) => !v)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border border-blue-300 text-blue-700 hover:bg-blue-50 transition-all"
                  >
                    <Calendar size={12} />スケジュール投稿
                  </button>
                </div>
                {showScheduleInput && (
                  <div className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50"
                    />
                    <button
                      onClick={() => { handleApprove('schedule'); setShowScheduleInput(false); }}
                      disabled={!scheduledAt}
                      className="px-4 py-2 rounded-lg text-white text-xs font-bold disabled:opacity-40 transition-all"
                      style={{ backgroundColor: ACCENT }}
                    >
                      確定
                    </button>
                  </div>
                )}
              </div>

              {/* Publish all bar */}
              {!allPublished && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">すべてのプラットフォームに投稿</p>
                    <p className="text-xs text-slate-400 mt-0.5">Instagram・ブログ・GBP・Xに同時投稿します</p>
                  </div>
                  <button
                    onClick={publishAll}
                    disabled={isPublishingAll}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60 transition-all"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {isPublishingAll ? (
                      <><Loader2 size={14} className="animate-spin" />投稿中...</>
                    ) : (
                      <><Send size={14} />すべて承認して投稿</>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Media Modal */}
    {showMediaModal && (
      <MediaModal
        onSelect={(url) => setImageUrls((prev) => [...prev, url])}
        onClose={() => setShowMediaModal(false)}
      />
    )}
    </>
  );
}
