"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Users, Settings, Instagram, Globe, FileText, Save, LogOut,
  ChevronRight, CheckCircle, Clock, AlertCircle, Tag, Plus, X,
  BarChart3, Calendar,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Account = {
  id: string;
  paletteId: string;
  name: string;
  status: string;
  isStandard?: boolean;
};

type Settings = {
  igAccessToken: string;
  igBusinessAccountId: string;
  gbpAccessToken: string;
  gbpRefreshToken: string;
  gbpLocationId: string;
  blogUrl: string;
  blogWpUsername: string;
  blogApiKey: string;
  targetKeywords: string[];
  goals: string;
  defaultTone: string;
  hasPalStudio: boolean;
  hasPalTrust: boolean;
};

type Post = {
  id: string;
  paletteId: string;
  title: string;
  status: string;
  publishedPlatforms: string[];
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
  blogUrl: '',
  blogWpUsername: '',
  blogApiKey: '',
  targetKeywords: [],
  goals: '',
  defaultTone: 'professional',
  hasPalStudio: false,
  hasPalTrust: false,
});

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    draft: { label: '下書き', color: 'bg-slate-100 text-slate-600', icon: <FileText size={10} /> },
    preview: { label: 'プレビュー', color: 'bg-blue-50 text-blue-600', icon: <Clock size={10} /> },
    approved: { label: '承認済み', color: 'bg-yellow-50 text-yellow-700', icon: <CheckCircle size={10} /> },
    published: { label: '投稿済み', color: 'bg-green-50 text-green-700', icon: <CheckCircle size={10} /> },
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          blogUrl: s.blogUrl || '',
          blogWpUsername: s.blogWpUsername || '',
          blogApiKey: s.blogApiKey || '',
          targetKeywords: s.targetKeywords || [],
          goals: s.goals || '',
          defaultTone: s.defaultTone || 'professional',
          hasPalStudio: s.hasPalStudio || false,
          hasPalTrust: s.hasPalTrust || false,
        });
      } else {
        setSettings(emptySettings());
      }

      if (postsData.success) setPosts(postsData.posts || []);
      else setPosts([]);
    } catch {
      setSettings(emptySettings());
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  const handleSelectAccount = (account: Account) => {
    setSelectedAccount(account);
    setSaveStatus('idle');
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
                    {selectedAccount.isStandard && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: ACCENT_LIGHT, color: ACCENT }}>
                        Standard
                      </span>
                    )}
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

            {/* Posts table */}
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
                  {posts.slice(0, 10).map((post) => (
                    <div key={post.id} className="px-5 py-3 flex items-center gap-4">
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

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

            {/* Instagram */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <Instagram size={12} style={{ color: ACCENT }} />Instagram API
              </p>
              <div className="space-y-2">
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
            </div>

            {/* GBP */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <Globe size={12} className="text-blue-500" />Google Business Profile
              </p>
              <div className="space-y-2">
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
