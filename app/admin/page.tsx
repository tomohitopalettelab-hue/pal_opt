"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Users, Settings, Instagram, Globe, FileText, Save, LogOut,
  ChevronRight, CheckCircle, Clock, AlertCircle, Tag, Plus, X,
  BarChart3, Calendar, ArrowLeft, Link2, RefreshCw, Circle, ClipboardList,
  Shield, Bell, LayoutTemplate, Check, CircleX, Twitter, Trash2, Pencil,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Account = {
  id: string;
  paletteId: string;
  name: string;
  status: string;
};

type Settings = {
  igAccessToken: string;
  igBusinessAccountId: string;
  gbpAccessToken: string;
  gbpRefreshToken: string;
  gbpLocationId: string;
  xAccessToken: string;
  blogUrl: string;
  blogWpUsername: string;
  blogApiKey: string;
  targetKeywords: string[];
  goals: string;
  defaultTone: string;
  hasPalStudio: boolean;
  hasPalTrust: boolean;
  notificationType: 'none' | 'email' | 'line';
  notificationEmail: string;
  lineUserId: string;
};

type Template = {
  id?: string;
  paletteId: string;
  name: string;
  category: string;
  topic: string;
  tone: string;
  contentTemplate: string;
};

type Post = {
  id: string;
  paletteId: string;
  title: string;
  topic?: string;
  keywords?: string[];
  targetAudience?: string | null;
  status: string;
  publishedPlatforms: string[];
  instagramCaption?: string | null;
  instagramImageUrl?: string | null;
  blogTitle?: string | null;
  blogBodyHtml?: string | null;
  blogSlug?: string | null;
  gbpSummary?: string | null;
  gbpCallToAction?: string | null;
  errorLog?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const ACCENT = '#A62183';
const ACCENT_DARK = '#8a1a6d';
const ACCENT_LIGHT = '#f5e6f0';

const emptySettings = (): Settings => ({
  igAccessToken: '',
  igBusinessAccountId: '',
  gbpAccessToken: '',
  gbpRefreshToken: '',
  gbpLocationId: '',
  xAccessToken: '',
  blogUrl: '',
  blogWpUsername: '',
  blogApiKey: '',
  targetKeywords: [],
  goals: '',
  defaultTone: 'professional',
  hasPalStudio: false,
  hasPalTrust: false,
  notificationType: 'none',
  notificationEmail: '',
  lineUserId: '',
});

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    draft: { label: '下書き', color: 'bg-slate-100 text-slate-600', icon: <FileText size={10} /> },
    preview: { label: 'プレビュー', color: 'bg-blue-50 text-blue-600', icon: <Clock size={10} /> },
    approved: { label: '承認済み', color: 'bg-yellow-50 text-yellow-700', icon: <CheckCircle size={10} /> },
    published: { label: '投稿済み', color: 'bg-green-50 text-green-700', icon: <CheckCircle size={10} /> },
    pending_approval: { label: '承認待ち', color: 'bg-orange-50 text-orange-600', icon: <Clock size={10} /> },
    failed: { label: 'エラー', color: 'bg-red-50 text-red-600', icon: <AlertCircle size={10} /> },
  };
  const b = map[status] || map.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${b.color}`}>
      {b.icon}{b.label}
    </span>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [settings, setSettings] = useState<Settings>(emptySettings());
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [error, setError] = useState('');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'templates' | 'approval'>('posts');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false);
  const [approvalReason, setApprovalReason] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // OAuth関連ステート
  type OAuthToast = { type: 'success' | 'error'; message: string } | null;
  const [oauthToast, setOauthToast] = useState<OAuthToast>(null);
  type IgAccount = { igId: string; igName: string; pageId: string; pageName: string };
  type GbpLocation = { id: string; name: string; address: string };
  const [igSelectAccounts, setIgSelectAccounts] = useState<IgAccount[]>([]);
  const [gbpSelectLocations, setGbpSelectLocations] = useState<GbpLocation[]>([]);
  const [oauthPaletteId, setOauthPaletteId] = useState('');

  // Load accounts
  useEffect(() => {
    (async () => {
      setIsLoadingAccounts(true);
      try {
        const res = await fetch('/api/admin/customers');
        const data = await res.json();
        if (data.success) setAccounts(data.accounts || []);
        else setError(data.error || '顧客一覧の取得に失敗しました。');
      } catch {
        setError('ネットワークエラーが発生しました。');
      } finally {
        setIsLoadingAccounts(false);
      }
    })();
  }, []);

  // Load settings when account selected
  const loadSettings = useCallback(async (paletteId: string) => {
    setIsLoadingSettings(true);
    try {
      const [settingsRes, postsRes] = await Promise.all([
        fetch(`/api/admin/settings?paletteId=${encodeURIComponent(paletteId)}`),
        fetch(`/api/admin/posts?paletteId=${encodeURIComponent(paletteId)}`),
      ]);
      const settingsData = await settingsRes.json();
      const postsData = await postsRes.json();

      if (settingsData.success && settingsData.settings) {
        const s = settingsData.settings;
        setSettings({
          igAccessToken: s.igAccessToken || '',
          igBusinessAccountId: s.igBusinessAccountId || '',
          gbpAccessToken: s.gbpAccessToken || '',
          gbpRefreshToken: s.gbpRefreshToken || '',
          gbpLocationId: s.gbpLocationId || '',
          xAccessToken: s.xAccessToken || '',
          blogUrl: s.blogUrl || '',
          blogWpUsername: s.blogWpUsername || '',
          blogApiKey: s.blogApiKey || '',
          targetKeywords: s.targetKeywords || [],
          goals: s.goals || '',
          defaultTone: s.defaultTone || 'professional',
          hasPalStudio: s.hasPalStudio || false,
          hasPalTrust: s.hasPalTrust || false,
          notificationType: s.notificationType || 'none',
          notificationEmail: s.notificationEmail || '',
          lineUserId: s.lineUserId || '',
        });
      } else {
        setSettings(emptySettings());
      }

      // Load templates
      try {
        const templatesRes = await fetch(`/api/admin/templates?paletteId=${encodeURIComponent(paletteId)}`);
        const templatesData = await templatesRes.json();
        if (templatesData.success) setTemplates(templatesData.templates || []);
        else setTemplates([]);
      } catch { setTemplates([]); }

      if (postsData.success) setPosts(postsData.posts || []);
      else setPosts([]);
    } catch {
      setSettings(emptySettings());
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  // OAuth コールバック結果をURLパラメータから読み取る
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const pid = p.get('paletteId') || '';

    const showToast = (type: 'success' | 'error', message: string) => {
      setOauthToast({ type, message });
      setTimeout(() => setOauthToast(null), 5000);
    };

    if (p.get('ig_connected')) {
      const user = p.get('ig_user') ? `（@${p.get('ig_user')}）` : '';
      showToast('success', `Instagram連携が完了しました${user}`);
      if (pid) setOauthPaletteId(pid);
    } else if (p.get('ig_error')) {
      showToast('error', `Instagram連携エラー: ${decodeURIComponent(p.get('ig_error') || '')}`);
    } else if (p.get('ig_select')) {
      const raw = p.get('accounts') || '';
      try {
        const list: IgAccount[] = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/')));
        setIgSelectAccounts(list);
        if (pid) setOauthPaletteId(pid);
      } catch { showToast('error', 'アカウント選択データの解析に失敗しました。'); }
    }

    if (p.get('gbp_connected')) {
      const name = p.get('gbp_name') ? `（${decodeURIComponent(p.get('gbp_name') || '')}）` : '';
      showToast('success', `Google Business Profile連携が完了しました${name}`);
      if (pid) setOauthPaletteId(pid);
    } else if (p.get('gbp_error')) {
      showToast('error', `GBP連携エラー: ${decodeURIComponent(p.get('gbp_error') || '')}`);
    } else if (p.get('gbp_select')) {
      const raw = p.get('locations') || '';
      try {
        const list: GbpLocation[] = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/')));
        setGbpSelectLocations(list);
        if (pid) setOauthPaletteId(pid);
      } catch { showToast('error', 'ロケーション選択データの解析に失敗しました。'); }
    }

    if (p.get('x_connected')) {
      showToast('success', 'X (Twitter) 連携が完了しました');
      if (pid) setOauthPaletteId(pid);
    } else if (p.get('x_error')) {
      showToast('error', `X連携エラー: ${decodeURIComponent(p.get('x_error') || '')}`);
    }

    // クリーンURL（履歴に残さない）
    if (p.toString()) window.history.replaceState({}, '', '/admin');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // OAuth完了後にアカウントが自動選択されたら設定を再読み込み
  useEffect(() => {
    if (!oauthPaletteId || accounts.length === 0) return;
    const target = accounts.find((a) => a.paletteId === oauthPaletteId);
    if (target) {
      setSelectedAccount(target);
      loadSettings(target.paletteId);
      setOauthPaletteId('');
    }
  }, [oauthPaletteId, accounts, loadSettings]);

  const handleSelectAccount = (account: Account) => {
    setSelectedAccount(account);
    setSaveStatus('idle');
    setSelectedPost(null);
    setActiveTab('posts');
    setEditingTemplate(null);
    setIsTemplateFormOpen(false);
    loadSettings(account.paletteId);
  };

  const handleSaveSettings = async () => {
    if (!selectedAccount) return;
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paletteId: selectedAccount.paletteId, ...settings }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus('saved');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        setError(data.error || '保存に失敗しました。');
      }
    } catch {
      setSaveStatus('error');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const addKeyword = () => {
    const kw = newKeyword.trim();
    if (kw && !settings.targetKeywords.includes(kw)) {
      setSettings((s) => ({ ...s, targetKeywords: [...s.targetKeywords, kw] }));
    }
    setNewKeyword('');
  };

  const removeKeyword = (kw: string) => {
    setSettings((s) => ({ ...s, targetKeywords: s.targetKeywords.filter((k) => k !== kw) }));
  };

  // Template handlers
  const handleSaveTemplate = async (template: Template) => {
    if (!selectedAccount) return;
    const isEdit = !!template.id;
    const url = isEdit ? '/api/admin/templates' : '/api/admin/templates';
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...template, paletteId: selectedAccount.paletteId }),
    });
    const data = await res.json();
    if (data.success) {
      loadSettings(selectedAccount.paletteId);
      setEditingTemplate(null);
      setIsTemplateFormOpen(false);
    } else {
      setError(data.error || 'テンプレートの保存に失敗しました。');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!selectedAccount) return;
    const res = await fetch('/api/admin/templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: templateId, paletteId: selectedAccount.paletteId }),
    });
    const data = await res.json();
    if (data.success) {
      loadSettings(selectedAccount.paletteId);
    } else {
      setError(data.error || 'テンプレートの削除に失敗しました。');
    }
  };

  // Approval handler
  const handleApproval = async (postId: string, action: 'approve' | 'reject') => {
    const res = await fetch('/api/admin/posts/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, action, reason: approvalReason }),
    });
    const data = await res.json();
    if (data.success) {
      setApprovalReason('');
      if (selectedAccount) loadSettings(selectedAccount.paletteId);
    } else {
      setError(data.error || '承認処理に失敗しました。');
    }
  };

  const pendingPosts = posts.filter((p) => p.status === 'pending_approval');

  const filteredAccounts = accounts.filter((a) =>
    !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.paletteId.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const thisMonthPosts = posts.filter((p) => {
    const d = new Date(p.updatedAt);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F5F0F4] text-slate-800">

      {/* ─── OAuth トースト通知 ────────────────────────────────────────────── */}
      {oauthToast && (
        <div className={`fixed top-4 right-4 z-50 flex items-start gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm ${oauthToast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {oauthToast.type === 'success' ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
          <span>{oauthToast.message}</span>
          <button onClick={() => setOauthToast(null)} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      {/* ─── Instagram アカウント選択モーダル ──────────────────────────────── */}
      {igSelectAccounts.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 space-y-4">
            <p className="font-bold text-slate-800 flex items-center gap-2"><Instagram size={16} style={{ color: '#E1306C' }} />Instagramアカウントを選択</p>
            <p className="text-xs text-slate-500">複数のInstagramビジネスアカウントが見つかりました。使用するアカウントを選択してください。</p>
            <div className="space-y-2">
              {igSelectAccounts.map((acc) => (
                <button
                  key={acc.igId}
                  onClick={async () => {
                    const res = await fetch('/api/oauth/instagram/select', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ igId: acc.igId, igName: acc.igName, paletteId: oauthPaletteId }),
                    });
                    const d = await res.json();
                    setIgSelectAccounts([]);
                    if (d.success) {
                      setOauthToast({ type: 'success', message: `Instagram連携完了（@${acc.igName}）` });
                      setTimeout(() => setOauthToast(null), 4000);
                      if (oauthPaletteId) loadSettings(oauthPaletteId);
                    } else {
                      setOauthToast({ type: 'error', message: d.error || '保存に失敗しました。' });
                      setTimeout(() => setOauthToast(null), 5000);
                    }
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl border border-slate-200 hover:border-pink-400 hover:bg-pink-50 transition-colors text-sm"
                >
                  <p className="font-bold text-slate-800">@{acc.igName}</p>
                  <p className="text-[10px] text-slate-400">{acc.pageName} (ID: {acc.igId})</p>
                </button>
              ))}
            </div>
            <button onClick={() => setIgSelectAccounts([])} className="w-full text-xs text-slate-400 hover:text-slate-600">キャンセル</button>
          </div>
        </div>
      )}

      {/* ─── GBP ロケーション選択モーダル ──────────────────────────────────── */}
      {gbpSelectLocations.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 space-y-4">
            <p className="font-bold text-slate-800 flex items-center gap-2"><Globe size={16} className="text-blue-500" />ロケーションを選択</p>
            <p className="text-xs text-slate-500">複数のGBPロケーションが見つかりました。使用するロケーションを選択してください。</p>
            <div className="space-y-2">
              {gbpSelectLocations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={async () => {
                    const res = await fetch('/api/oauth/gbp/select', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ locationId: loc.id, locationName: loc.name, paletteId: oauthPaletteId }),
                    });
                    const d = await res.json();
                    setGbpSelectLocations([]);
                    if (d.success) {
                      setOauthToast({ type: 'success', message: `GBP連携完了（${loc.name}）` });
                      setTimeout(() => setOauthToast(null), 4000);
                      if (oauthPaletteId) loadSettings(oauthPaletteId);
                    } else {
                      setOauthToast({ type: 'error', message: d.error || '保存に失敗しました。' });
                      setTimeout(() => setOauthToast(null), 5000);
                    }
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm"
                >
                  <p className="font-bold text-slate-800">{loc.name}</p>
                  {loc.address && <p className="text-[10px] text-slate-400">{loc.address}</p>}
                </button>
              ))}
            </div>
            <button onClick={() => setGbpSelectLocations([])} className="w-full text-xs text-slate-400 hover:text-slate-600">キャンセル</button>
          </div>
        </div>
      )}

      {/* ─── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full flex-shrink-0">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
              <span className="text-white text-xs font-black">PO</span>
            </div>
            <div>
              <p className="text-sm font-black text-slate-800 leading-none">pal opt</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Admin</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-slate-100">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="顧客を検索..."
            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50"
          />
        </div>

        {/* Account list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="px-3 py-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Users size={10} />顧客一覧
              <span className="ml-auto text-[10px] bg-slate-100 px-1.5 rounded-full">{accounts.length}</span>
            </p>
          </div>

          {isLoadingAccounts ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400">読み込み中...</div>
          ) : filteredAccounts.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400">
              {searchQuery ? '一致する顧客が見つかりません' : 'pal_opt 契約中の顧客がいません'}
            </div>
          ) : (
            filteredAccounts.map((account) => {
              const isSelected = selectedAccount?.id === account.id;
              return (
                <button
                  key={account.id}
                  onClick={() => handleSelectAccount(account)}
                  className="w-full px-4 py-3 flex items-center justify-between border-b border-slate-100 text-left transition-colors"
                  style={{
                    backgroundColor: isSelected ? ACCENT_LIGHT : undefined,
                    borderRight: isSelected ? `4px solid ${ACCENT}` : '4px solid transparent',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#fdf7fc'; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = ''; }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{account.name}</p>
                    <p className="text-[10px] text-slate-400">{account.paletteId}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                </button>
              );
            })
          )}
        </div>

        {/* Logout */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <LogOut size={12} />
            ログアウト
          </button>
        </div>
      </aside>

      {/* ─── CENTER MAIN ───────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {!selectedAccount ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: ACCENT_LIGHT }}>
              <Users size={28} style={{ color: ACCENT }} />
            </div>
            <p className="text-sm font-bold">顧客を選択してください</p>
            <p className="text-xs mt-1">左のサイドバーから顧客を選んでください</p>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-800">{selectedAccount.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-slate-400 font-mono">{selectedAccount.paletteId}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className="text-2xl font-black" style={{ color: ACCENT }}>{posts.length}</p>
                    <p className="text-[10px] text-slate-400">総投稿数</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-green-600">{posts.filter((p) => p.status === 'published').length}</p>
                    <p className="text-[10px] text-slate-400">投稿済み</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-blue-600">{thisMonthPosts.length}</p>
                    <p className="text-[10px] text-slate-400">今月</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              {([
                { key: 'posts' as const, label: '最近の投稿', icon: <BarChart3 size={12} /> },
                { key: 'approval' as const, label: `承認待ち${pendingPosts.length > 0 ? ` (${pendingPosts.length})` : ''}`, icon: <Shield size={12} /> },
                { key: 'templates' as const, label: 'テンプレート', icon: <LayoutTemplate size={12} /> },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                  style={activeTab === tab.key
                    ? { backgroundColor: ACCENT, color: '#fff' }
                    : { backgroundColor: '#fff', color: '#64748b', border: '1px solid #e2e8f0' }}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>

            {/* Posts table */}
            {activeTab === 'posts' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                <BarChart3 size={14} style={{ color: ACCENT }} />
                <p className="text-sm font-bold">最近の投稿</p>
              </div>

              {isLoadingSettings ? (
                <div className="p-8 text-center text-xs text-slate-400">読み込み中...</div>
              ) : posts.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">投稿履歴がありません</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {posts.slice(0, 20).map((post) => {
                    const isSelected = selectedPost?.id === post.id;
                    return (
                      <button
                        key={post.id}
                        onClick={() => setSelectedPost(isSelected ? null : post)}
                        className="w-full px-5 py-3 flex items-center gap-4 text-left transition-colors hover:bg-slate-50"
                        style={isSelected ? { backgroundColor: ACCENT_LIGHT } : {}}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{post.title || '（タイトルなし）'}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Calendar size={10} className="text-slate-400" />
                            <span className="text-[10px] text-slate-400">
                              {new Date(post.updatedAt).toLocaleDateString('ja-JP')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {post.publishedPlatforms.map((p) => (
                            <span key={p} className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-bold">
                              {p === 'instagram' ? 'IG' : p === 'blog' ? 'Blog' : 'GBP'}
                            </span>
                          ))}
                          {statusBadge(post.status)}
                          <ChevronRight size={12} className="text-slate-300" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            )}

            {/* Approval Queue */}
            {activeTab === 'approval' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                <Shield size={14} style={{ color: ACCENT }} />
                <p className="text-sm font-bold">承認待ち投稿</p>
              </div>

              {pendingPosts.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">承認待ちの投稿はありません</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingPosts.map((post) => (
                    <div key={post.id} className="px-5 py-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{post.title || '（タイトルなし）'}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Calendar size={10} className="text-slate-400" />
                            <span className="text-[10px] text-slate-400">
                              {new Date(post.createdAt).toLocaleDateString('ja-JP')}
                            </span>
                            {statusBadge(post.status)}
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedPost(post)}
                          className="text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500"
                        >
                          プレビュー
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          value={approvalReason}
                          onChange={(e) => setApprovalReason(e.target.value)}
                          placeholder="理由（任意）"
                          className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                        />
                        <button
                          onClick={() => handleApproval(post.id, 'approve')}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-80"
                          style={{ backgroundColor: '#16a34a' }}
                        >
                          <Check size={11} />承認
                        </button>
                        <button
                          onClick={() => handleApproval(post.id, 'reject')}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-500 transition-opacity hover:opacity-80"
                        >
                          <CircleX size={11} />却下
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Templates */}
            {activeTab === 'templates' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LayoutTemplate size={14} style={{ color: ACCENT }} />
                  <p className="text-sm font-bold">テンプレート</p>
                </div>
                <button
                  onClick={() => {
                    setEditingTemplate({ paletteId: selectedAccount?.paletteId || '', name: '', category: '', topic: '', tone: 'professional', contentTemplate: '{}' });
                    setIsTemplateFormOpen(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-80"
                  style={{ backgroundColor: ACCENT }}
                >
                  <Plus size={11} />新規作成
                </button>
              </div>

              {templates.length === 0 && !isTemplateFormOpen ? (
                <div className="p-8 text-center text-xs text-slate-400">テンプレートがありません</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {templates.map((tpl) => (
                    <div key={tpl.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{tpl.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {tpl.category && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: ACCENT_LIGHT, color: ACCENT }}>{tpl.category}</span>}
                          {tpl.topic && <span className="text-[10px] text-slate-400">{tpl.topic}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => { setEditingTemplate(tpl); setIsTemplateFormOpen(true); }}
                        className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => tpl.id && handleDeleteTemplate(tpl.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Template Form */}
              {isTemplateFormOpen && editingTemplate && (
                <div className="p-5 border-t border-slate-100 space-y-3">
                  <p className="text-xs font-bold text-slate-500">{editingTemplate.id ? 'テンプレートを編集' : '新規テンプレート'}</p>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">名前</label>
                      <input
                        value={editingTemplate.name}
                        onChange={(e) => setEditingTemplate((t) => t ? { ...t, name: e.target.value } : t)}
                        placeholder="テンプレート名"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">カテゴリ</label>
                        <input
                          value={editingTemplate.category}
                          onChange={(e) => setEditingTemplate((t) => t ? { ...t, category: e.target.value } : t)}
                          placeholder="例：プロモーション"
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">トピック</label>
                        <input
                          value={editingTemplate.topic}
                          onChange={(e) => setEditingTemplate((t) => t ? { ...t, topic: e.target.value } : t)}
                          placeholder="例：新商品紹介"
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">トーン</label>
                      <select
                        value={editingTemplate.tone}
                        onChange={(e) => setEditingTemplate((t) => t ? { ...t, tone: e.target.value } : t)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50"
                      >
                        <option value="professional">プロフェッショナル</option>
                        <option value="casual">カジュアル</option>
                        <option value="friendly">フレンドリー</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">コンテンツテンプレート（JSON）</label>
                      <textarea
                        value={editingTemplate.contentTemplate}
                        onChange={(e) => setEditingTemplate((t) => t ? { ...t, contentTemplate: e.target.value } : t)}
                        placeholder='{"title": "{{title}}", "body": "{{body}}"}'
                        rows={5}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white resize-none font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveTemplate(editingTemplate)}
                      className="flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-80"
                      style={{ backgroundColor: ACCENT }}
                    >
                      <Save size={11} />保存
                    </button>
                    <button
                      onClick={() => { setIsTemplateFormOpen(false); setEditingTemplate(null); }}
                      className="flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        )}
      </main>

      {/* ─── POST DETAIL DRAWER ────────────────────────────────────────────── */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 backdrop-blur-sm p-6" onClick={() => setSelectedPost(null)}>
          <div
            className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden mt-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <button
                onClick={() => setSelectedPost(null)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft size={12} />閉じる
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-800 truncate">{selectedPost.title || '（タイトルなし）'}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {statusBadge(selectedPost.status)}
                  <span className="text-[10px] text-slate-400 font-mono">{selectedPost.paletteId}</span>
                  <span className="text-[10px] text-slate-400">
                    {selectedPost.publishedAt
                      ? `投稿: ${new Date(selectedPost.publishedAt).toLocaleDateString('ja-JP')}`
                      : `更新: ${new Date(selectedPost.updatedAt).toLocaleDateString('ja-JP')}`}
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5">
                {['instagram','blog','gbp'].map((p) => {
                  const pub = selectedPost.publishedPlatforms.includes(p);
                  return (
                    <span key={p} className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${pub ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                      {p === 'instagram' ? 'IG' : p === 'blog' ? 'Blog' : 'GBP'}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Meta */}
            {(selectedPost.keywords?.length || selectedPost.targetAudience) && (
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-4 text-xs flex-shrink-0">
                {selectedPost.keywords?.length ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-bold">キーワード：</span>
                    {selectedPost.keywords.map((k) => (
                      <span key={k} className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: ACCENT_LIGHT, color: ACCENT }}>{k}</span>
                    ))}
                  </div>
                ) : null}
                {selectedPost.targetAudience && (
                  <div><span className="text-slate-400 font-bold">ターゲット：</span>{selectedPost.targetAudience}</div>
                )}
              </div>
            )}

            {/* Content grid */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-3 gap-4">
              {/* Instagram */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center gap-2">
                  <Instagram size={12} style={{ color: '#E1306C' }} />
                  <span className="text-xs font-bold text-slate-700">Instagram</span>
                  {selectedPost.publishedPlatforms.includes('instagram') && <CheckCircle size={11} className="ml-auto text-green-500" />}
                </div>
                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                  {selectedPost.instagramImageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={selectedPost.instagramImageUrl} alt="" className="w-full aspect-square object-cover rounded-lg mb-3 border border-slate-200" />
                  )}
                  {selectedPost.instagramCaption
                    ? <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedPost.instagramCaption}</p>
                    : <p className="text-xs text-slate-400 italic">コンテンツなし</p>}
                </div>
              </div>

              {/* Blog */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center gap-2">
                  <FileText size={12} className="text-blue-500" />
                  <span className="text-xs font-bold text-slate-700">ブログ記事</span>
                  {selectedPost.publishedPlatforms.includes('blog') && <CheckCircle size={11} className="ml-auto text-green-500" />}
                </div>
                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                  {selectedPost.blogTitle && <p className="text-sm font-black text-slate-800 mb-2">{selectedPost.blogTitle}</p>}
                  {selectedPost.blogSlug && <p className="text-[10px] font-mono text-slate-400 mb-2">/{selectedPost.blogSlug}</p>}
                  {selectedPost.blogBodyHtml
                    ? <div className="text-xs text-slate-600 leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: selectedPost.blogBodyHtml }} />
                    : <p className="text-xs text-slate-400 italic">コンテンツなし</p>}
                </div>
              </div>

              {/* GBP */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center gap-2">
                  <Globe size={12} className="text-green-500" />
                  <span className="text-xs font-bold text-slate-700">GBP最新情報</span>
                  {selectedPost.publishedPlatforms.includes('gbp') && <CheckCircle size={11} className="ml-auto text-green-500" />}
                </div>
                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                  {selectedPost.gbpSummary
                    ? <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedPost.gbpSummary}</p>
                    : <p className="text-xs text-slate-400 italic">コンテンツなし</p>}
                  {selectedPost.gbpCallToAction && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400">CTA</span>
                      <p className="text-xs font-bold text-blue-600 mt-0.5">{selectedPost.gbpCallToAction}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Error log */}
            {selectedPost.errorLog && (
              <div className="px-6 pb-4 flex-shrink-0">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-red-700 mb-1 flex items-center gap-1">
                    <AlertCircle size={12} />エラーログ
                  </p>
                  <p className="text-[11px] text-red-600 font-mono whitespace-pre-wrap">{selectedPost.errorLog}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── RIGHT SETTINGS PANEL ──────────────────────────────────────────── */}
      <aside className="w-72 bg-white border-l border-slate-200 flex flex-col h-full flex-shrink-0 overflow-y-auto custom-scrollbar">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Settings size={14} style={{ color: ACCENT }} />
          <p className="text-sm font-bold">API設定</p>
          {selectedAccount && (
            <span className="ml-auto text-[10px] text-slate-400 truncate max-w-[80px]">{selectedAccount.name}</span>
          )}
        </div>

        {!selectedAccount ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-slate-400 text-center px-4">顧客を選択すると<br />設定が表示されます</p>
          </div>
        ) : (
          <div className="flex-1 p-4 space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-600">{error}</div>
            )}

            {/* ── セットアップ状況サマリー ────────────────────────── */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-2">
                <ClipboardList size={10} />セットアップ状況
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <Instagram size={11} style={{ color: '#E1306C' }} />Instagram
                  </span>
                  {settings.igAccessToken && settings.igBusinessAccountId
                    ? <span className="flex items-center gap-1 text-[10px] font-bold text-green-600"><CheckCircle size={10} />接続済み</span>
                    : <span className="flex items-center gap-1 text-[10px] text-slate-400"><Circle size={10} />未接続</span>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <Globe size={11} className="text-blue-500" />Google Business
                  </span>
                  {settings.gbpAccessToken && settings.gbpLocationId
                    ? <span className="flex items-center gap-1 text-[10px] font-bold text-green-600"><CheckCircle size={10} />接続済み</span>
                    : <span className="flex items-center gap-1 text-[10px] text-slate-400"><Circle size={10} />未接続</span>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <Twitter size={11} className="text-slate-800" />X (Twitter)
                  </span>
                  {settings.xAccessToken
                    ? <span className="flex items-center gap-1 text-[10px] font-bold text-green-600"><CheckCircle size={10} />接続済み</span>
                    : <span className="flex items-center gap-1 text-[10px] text-slate-400"><Circle size={10} />未接続</span>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <FileText size={11} className="text-green-500" />ブログ
                  </span>
                  {settings.blogUrl && settings.blogApiKey
                    ? <span className="flex items-center gap-1 text-[10px] font-bold text-green-600"><CheckCircle size={10} />設定済み</span>
                    : <span className="flex items-center gap-1 text-[10px] text-slate-400"><Circle size={10} />未設定</span>}
                </div>
              </div>
            </div>

            {/* Instagram */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <Instagram size={12} style={{ color: ACCENT }} />Instagram API
                {settings.igAccessToken && settings.igBusinessAccountId && (
                  <span className="ml-auto flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                    <CheckCircle size={9} />接続済み
                  </span>
                )}
              </p>
              {/* OAuthで接続 */}
              <a
                href={`/api/oauth/instagram?paletteId=${encodeURIComponent(selectedAccount?.paletteId || '')}`}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#E1306C' }}
              >
                <Link2 size={11} />
                {settings.igAccessToken && settings.igBusinessAccountId ? 'Instagramを再接続' : 'Instagramと接続（OAuth）'}
              </a>
              <div className="bg-pink-50 border border-pink-100 rounded-lg px-2.5 py-2 text-[10px] text-pink-700 space-y-0.5 leading-relaxed">
                <p className="font-bold">📋 接続前の確認</p>
                <p>・お客さんのFacebookページ管理者を<br/>　自分のFBアカウントに追加してもらう</p>
                <p>・Instagram Professional アカウントが<br/>　そのFBページに紐づいていること</p>
              </div>
              {/* 手動入力（上書き用） */}
              <details className="text-[10px]">
                <summary className="cursor-pointer text-slate-400 select-none">手動入力（上書き）</summary>
                <div className="space-y-2 mt-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">アクセストークン</label>
                    <input
                      type="password"
                      value={settings.igAccessToken}
                      onChange={(e) => setSettings((s) => ({ ...s, igAccessToken: e.target.value }))}
                      placeholder="EAA..."
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">ビジネスアカウントID</label>
                    <input
                      value={settings.igBusinessAccountId}
                      onChange={(e) => setSettings((s) => ({ ...s, igBusinessAccountId: e.target.value }))}
                      placeholder="1234567890"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              </details>
            </div>

            {/* GBP */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <Globe size={12} className="text-blue-500" />Google Business Profile
                {settings.gbpAccessToken && settings.gbpLocationId && (
                  <span className="ml-auto flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                    <CheckCircle size={9} />接続済み
                  </span>
                )}
              </p>
              {/* OAuthで接続 */}
              <a
                href={`/api/oauth/gbp?paletteId=${encodeURIComponent(selectedAccount?.paletteId || '')}`}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-80 bg-blue-500"
              >
                <Link2 size={11} />
                {settings.gbpAccessToken && settings.gbpLocationId ? 'Googleを再接続' : 'Googleと接続（OAuth）'}
              </a>
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-2 text-[10px] text-blue-700 space-y-0.5 leading-relaxed">
                <p className="font-bold">📋 接続前の確認</p>
                <p>・お客さんのGBPに自分のGoogleアカウントを<br/>　「管理者」として招待してもらう</p>
                <p>・招待受諾後にこのボタンで接続する</p>
              </div>
              {/* リフレッシュトークンがある場合はトークン更新ボタン */}
              {settings.gbpRefreshToken && (
                <button
                  onClick={async () => {
                    if (!selectedAccount) return;
                    const res = await fetch('/api/oauth/gbp/refresh', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ paletteId: selectedAccount.paletteId }),
                    });
                    const d = await res.json();
                    if (d.success) {
                      setSettings((s) => ({ ...s, gbpAccessToken: d.accessToken }));
                      setOauthToast({ type: 'success', message: 'GBPアクセストークンを更新しました。' });
                      setTimeout(() => setOauthToast(null), 4000);
                    } else {
                      setOauthToast({ type: 'error', message: d.error || 'トークン更新に失敗しました。' });
                      setTimeout(() => setOauthToast(null), 5000);
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs font-bold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <RefreshCw size={11} />アクセストークンを更新
                </button>
              )}
              {/* 手動入力（上書き用） */}
              <details className="text-[10px]">
                <summary className="cursor-pointer text-slate-400 select-none">手動入力（上書き）</summary>
                <div className="space-y-2 mt-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">アクセストークン</label>
                    <input
                      type="password"
                      value={settings.gbpAccessToken}
                      onChange={(e) => setSettings((s) => ({ ...s, gbpAccessToken: e.target.value }))}
                      placeholder="ya29..."
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">ロケーションID</label>
                    <input
                      value={settings.gbpLocationId}
                      onChange={(e) => setSettings((s) => ({ ...s, gbpLocationId: e.target.value }))}
                      placeholder="accounts/.../locations/..."
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              </details>
            </div>

            {/* X (Twitter) */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <Twitter size={12} className="text-slate-800" />X (Twitter)
                {settings.xAccessToken && (
                  <span className="ml-auto flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                    <CheckCircle size={9} />接続済み
                  </span>
                )}
              </p>
              <a
                href={`/api/oauth/x?paletteId=${encodeURIComponent(selectedAccount?.paletteId || '')}`}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-80 bg-slate-800"
              >
                <Link2 size={11} />
                {settings.xAccessToken ? 'X (Twitter) を再接続' : 'X (Twitter) を接続'}
              </a>
            </div>

            {/* Blog */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <FileText size={12} className="text-green-500" />Blog / WordPress
              </p>
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">サイトURL</label>
                  <input
                    value={settings.blogUrl}
                    onChange={(e) => setSettings((s) => ({ ...s, blogUrl: e.target.value }))}
                    placeholder="https://example.com"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">WordPressユーザー名</label>
                  <input
                    value={settings.blogWpUsername}
                    onChange={(e) => setSettings((s) => ({ ...s, blogWpUsername: e.target.value }))}
                    placeholder="admin"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">アプリパスワード / APIキー</label>
                  <input
                    type="password"
                    value={settings.blogApiKey}
                    onChange={(e) => setSettings((s) => ({ ...s, blogApiKey: e.target.value }))}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <Tag size={12} style={{ color: ACCENT }} />重点キーワード
              </p>
              <div className="flex gap-1.5">
                <input
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                  placeholder="キーワードを追加"
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                />
                <button
                  onClick={addKeyword}
                  className="p-1.5 rounded-lg text-white text-xs"
                  style={{ backgroundColor: ACCENT }}
                >
                  <Plus size={12} />
                </button>
              </div>
              {settings.targetKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {settings.targetKeywords.map((kw) => (
                    <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: ACCENT_LIGHT, color: ACCENT }}>
                      {kw}
                      <button onClick={() => removeKeyword(kw)}><X size={9} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Goals */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-500">目標・方針</label>
              <textarea
                value={settings.goals}
                onChange={(e) => setSettings((s) => ({ ...s, goals: e.target.value }))}
                placeholder="例：地域密着型の美容室として認知度向上、予約件数増加を目指す"
                rows={3}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white resize-none"
              />
            </div>

            {/* Tone */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-500">トーン</label>
              <select
                value={settings.defaultTone}
                onChange={(e) => setSettings((s) => ({ ...s, defaultTone: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50"
              >
                <option value="professional">プロフェッショナル</option>
                <option value="casual">カジュアル</option>
                <option value="friendly">フレンドリー</option>
              </select>
            </div>

            {/* Service integrations */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-500">連携サービス</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.hasPalStudio}
                  onChange={(e) => setSettings((s) => ({ ...s, hasPalStudio: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-xs text-slate-600">pal_studio（ブログ連携）</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.hasPalTrust}
                  onChange={(e) => setSettings((s) => ({ ...s, hasPalTrust: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-xs text-slate-600">pal_trust（口コミ連携）</span>
              </label>
            </div>

            {/* Notification Settings */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <Bell size={12} style={{ color: ACCENT }} />通知設定
              </p>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">通知タイプ</label>
                <select
                  value={settings.notificationType}
                  onChange={(e) => setSettings((s) => ({ ...s, notificationType: e.target.value as Settings['notificationType'] }))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50"
                >
                  <option value="none">なし</option>
                  <option value="email">メール</option>
                  <option value="line">LINE</option>
                </select>
              </div>
              {settings.notificationType === 'email' && (
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">通知先メールアドレス</label>
                  <input
                    type="email"
                    value={settings.notificationEmail}
                    onChange={(e) => setSettings((s) => ({ ...s, notificationEmail: e.target.value }))}
                    placeholder="example@example.com"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                  />
                </div>
              )}
              {settings.notificationType === 'line' && (
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">LINE ユーザーID</label>
                  <input
                    value={settings.lineUserId}
                    onChange={(e) => setSettings((s) => ({ ...s, lineUserId: e.target.value }))}
                    placeholder="U1234567890abcdef..."
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
                  />
                </div>
              )}
            </div>

            {/* Save button */}
            <button
              onClick={handleSaveSettings}
              disabled={saveStatus === 'saving'}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-60"
              style={{ backgroundColor: saveStatus === 'saved' ? '#16a34a' : ACCENT }}
              onMouseEnter={(e) => { if (saveStatus !== 'saving' && saveStatus !== 'saved') (e.currentTarget as HTMLButtonElement).style.backgroundColor = ACCENT_DARK; }}
              onMouseLeave={(e) => { if (saveStatus !== 'saved') (e.currentTarget as HTMLButtonElement).style.backgroundColor = ACCENT; }}
            >
              {saveStatus === 'saving' ? (
                <><span className="animate-spin">⟳</span> 保存中...</>
              ) : saveStatus === 'saved' ? (
                <><CheckCircle size={14} /> 保存しました</>
              ) : (
                <><Save size={14} /> 設定を保存</>
              )}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
