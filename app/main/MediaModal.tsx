'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, ImageIcon, Sparkles, Search, Loader2, RefreshCw } from 'lucide-react';

const ACCENT = '#A62183';

type MediaAsset = {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
};

type StockImage = {
  id: string;
  url: string;
  thumb: string;
  alt: string;
  photographer: string;
};

type TabId = 'upload' | 'library' | 'ai' | 'stock';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'upload',  label: 'アップロード', icon: <Upload size={12} /> },
  { id: 'library', label: 'メディア一覧', icon: <ImageIcon size={12} /> },
  { id: 'ai',      label: 'AI生成',       icon: <Sparkles size={12} /> },
  { id: 'stock',   label: '無料素材',     icon: <Search size={12} /> },
];

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

type Props = {
  onSelect: (url: string) => void;
  onClose: () => void;
};

export function MediaModal({ onSelect, onClose }: Props) {
  const [tab, setTab] = useState<TabId>('library');

  /* ── library ── */
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState('');

  /* ── upload ── */
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── stock ── */
  const [stockQuery, setStockQuery] = useState('');
  const [stockImages, setStockImages] = useState<StockImage[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState('');

  /* ── ai ── */
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiImages, setAiImages] = useState<StockImage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  /* ── Load library ── */
  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    setAssetsError('');
    try {
      const res = await fetch('/api/media');
      const data = await res.json();
      if (res.ok && Array.isArray(data.assets)) {
        setAssets(data.assets.filter((a: MediaAsset) => String(a.mimeType || '').startsWith('image/')));
      } else {
        setAssetsError(data.error || 'メディアの読み込みに失敗しました。');
      }
    } catch {
      setAssetsError('ネットワークエラーが発生しました。');
    } finally {
      setAssetsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'library') loadAssets();
  }, [tab, loadAssets]);

  /* ── Upload ── */
  const handleUpload = async () => {
    if (!uploadFiles.length) return;
    setIsUploading(true);
    setUploadError('');
    const uploaded: string[] = [];
    try {
      for (const file of uploadFiles) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        if (data.url) uploaded.push(String(data.url));
      }
      setUploadedUrls((prev) => [...prev, ...uploaded]);
      setUploadFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      // Switch to library to see result
      setTab('library');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'アップロードに失敗しました。');
    } finally {
      setIsUploading(false);
    }
  };

  /* ── Stock search ── */
  const handleStockSearch = async () => {
    if (!stockQuery.trim()) return;
    setStockLoading(true);
    setStockError('');
    try {
      const res = await fetch('/api/search-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: stockQuery }),
      });
      const data = await res.json();
      if (Array.isArray(data.images)) {
        setStockImages(data.images);
      } else {
        setStockError(data.error || '検索に失敗しました。');
      }
    } catch {
      setStockError('ネットワークエラーが発生しました。');
    } finally {
      setStockLoading(false);
    }
  };

  /* ── AI generate (keyword → stock search) ── */
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError('');
    try {
      const res = await fetch('/api/search-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiPrompt }),
      });
      const data = await res.json();
      if (Array.isArray(data.images)) {
        setAiImages(data.images);
      } else {
        setAiError(data.error || '生成に失敗しました。');
      }
    } catch {
      setAiError('エラーが発生しました。');
    } finally {
      setAiLoading(false);
    }
  };

  /* ── Helpers ── */
  const pick = (url: string) => { onSelect(url); onClose(); };

  const ImageGrid = ({ images, onPick }: { images: StockImage[]; onPick: (url: string) => void }) => (
    <div className="grid grid-cols-3 gap-2.5">
      {images.map((img) => (
        <button
          key={img.id}
          onClick={() => onPick(img.url)}
          className="group text-left rounded-xl border border-slate-100 overflow-hidden hover:shadow-md hover:border-slate-200 transition-all"
        >
          <div className="aspect-square bg-slate-100 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.thumb || img.url}
              alt={img.alt}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          </div>
          <div className="px-2 py-1.5">
            <p className="text-[9px] text-slate-400 truncate">📷 {img.photographer}</p>
            <p className="text-[10px] font-bold mt-0.5" style={{ color: ACCENT }}>この画像を使う</p>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: ACCENT }}
          >
            <ImageIcon size={14} className="text-white" />
          </div>
          <p className="text-sm font-black text-slate-800">メディアを選択</p>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 flex-shrink-0 bg-slate-50">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors"
              style={
                tab === t.id
                  ? { color: ACCENT, borderColor: ACCENT, backgroundColor: 'white' }
                  : { color: '#94a3b8', borderColor: 'transparent' }
              }
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ── Upload ── */}
          {tab === 'upload' && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all hover:border-slate-300"
                style={uploadFiles.length
                  ? { borderColor: `${ACCENT}80`, backgroundColor: '#fdf4fa' }
                  : { borderColor: '#e2e8f0' }
                }
              >
                <Upload size={28} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-bold text-slate-500">クリックして画像を選択</p>
                <p className="text-xs text-slate-400 mt-1">PNG・JPG・GIF・WebP（最大12MB）</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                />
              </div>

              {/* Preview */}
              {uploadFiles.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-500">{uploadFiles.length}件を選択中</p>
                  <div className="grid grid-cols-4 gap-2">
                    {uploadFiles.map((f, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden aspect-square bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={URL.createObjectURL(f)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1.5 py-1">
                          <p className="text-[8px] text-white truncate">{f.name}</p>
                          <p className="text-[8px] text-white/70">{formatBytes(f.size)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {uploadError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {uploadError}
                    </p>
                  )}
                  <button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="w-full py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {isUploading
                      ? <><Loader2 size={14} className="animate-spin" />アップロード中...</>
                      : <><Upload size={14} />アップロードする</>
                    }
                  </button>
                </div>
              )}

              {/* Already uploaded this session */}
              {uploadedUrls.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400">今回アップロード済み</p>
                  <div className="grid grid-cols-4 gap-2">
                    {uploadedUrls.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => pick(url)}
                        className="relative rounded-lg overflow-hidden aspect-square bg-slate-100 hover:ring-2 transition-all"
                        style={{ ['--tw-ring-color' as string]: ACCENT }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
                          <p className="text-[10px] font-bold text-white">選択</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Library ── */}
          {tab === 'library' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">アップロード済みメディア</p>
                <button
                  onClick={loadAssets}
                  disabled={assetsLoading}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={11} className={assetsLoading ? 'animate-spin' : ''} />
                  更新
                </button>
              </div>

              {assetsLoading && (
                <div className="py-10 text-center text-xs text-slate-400">
                  <Loader2 size={20} className="animate-spin mx-auto mb-2 text-slate-300" />
                  読み込み中...
                </div>
              )}
              {!assetsLoading && assetsError && (
                <div className="py-4 text-center text-xs text-red-500 bg-red-50 rounded-xl p-4">
                  {assetsError}
                </div>
              )}
              {!assetsLoading && !assetsError && assets.length === 0 && (
                <div className="py-10 text-center text-xs text-slate-400">
                  <ImageIcon size={28} className="mx-auto mb-2 text-slate-200" />
                  メディアがありません。<br />
                  「アップロード」タブから画像を追加してください。
                </div>
              )}
              {!assetsLoading && assets.length > 0 && (
                <div className="grid grid-cols-3 gap-2.5">
                  {assets.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => pick(asset.url)}
                      className="group text-left rounded-xl border border-slate-100 overflow-hidden hover:shadow-md hover:border-slate-200 transition-all"
                    >
                      <div className="aspect-square bg-slate-100 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={asset.url}
                          alt={asset.originalName || asset.fileName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="text-[10px] font-bold text-slate-600 truncate">
                          {asset.originalName || asset.fileName}
                        </p>
                        <p className="text-[9px] text-slate-400">{formatBytes(Number(asset.sizeBytes || 0))}</p>
                        <p className="text-[10px] font-bold mt-0.5" style={{ color: ACCENT }}>この画像を使う</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── AI生成 ── */}
          {tab === 'ai' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                投稿のテーマやキーワードを入力すると、関連するフリー素材を提案します。
              </p>
              <div className="flex gap-2">
                <input
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAiGenerate(); }}
                  placeholder="例：春の美容室、桜、おしゃれな内装"
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-slate-300 transition-colors"
                />
                <button
                  onClick={handleAiGenerate}
                  disabled={aiLoading || !aiPrompt.trim()}
                  className="px-4 py-2 rounded-lg text-white text-xs font-bold disabled:opacity-60 flex items-center gap-1.5 flex-shrink-0"
                  style={{ backgroundColor: ACCENT }}
                >
                  {aiLoading
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Sparkles size={12} />
                  }
                  提案
                </button>
              </div>

              {aiError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {aiError}
                </p>
              )}
              {aiLoading && (
                <div className="py-10 text-center text-xs text-slate-400">
                  <Loader2 size={20} className="animate-spin mx-auto mb-2" style={{ color: ACCENT }} />
                  AI が画像を提案中...
                </div>
              )}
              {!aiLoading && aiImages.length > 0 && (
                <ImageGrid images={aiImages} onPick={pick} />
              )}
            </div>
          )}

          {/* ── 無料素材 ── */}
          {tab === 'stock' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Unsplash のフリー素材を検索して使用できます。英語キーワードがより精度高く検索できます。
              </p>
              <div className="flex gap-2">
                <input
                  value={stockQuery}
                  onChange={(e) => setStockQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleStockSearch(); }}
                  placeholder="例：restaurant, flower, coffee shop"
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-slate-300 transition-colors"
                />
                <button
                  onClick={handleStockSearch}
                  disabled={stockLoading || !stockQuery.trim()}
                  className="px-4 py-2 rounded-lg text-white text-xs font-bold disabled:opacity-60 flex items-center gap-1.5 flex-shrink-0"
                  style={{ backgroundColor: ACCENT }}
                >
                  {stockLoading
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Search size={12} />
                  }
                  検索
                </button>
              </div>

              {stockError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {stockError}
                </p>
              )}
              {stockLoading && (
                <div className="py-10 text-center text-xs text-slate-400">検索中...</div>
              )}
              {!stockLoading && stockImages.length > 0 && (
                <ImageGrid images={stockImages} onPick={pick} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
