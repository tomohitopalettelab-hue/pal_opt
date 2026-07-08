'use client';

import { useMemo, useState } from 'react';
import {
  Loader2, Globe, Copy, Check, ExternalLink, Sparkles, X, Plus, Trash2, Link2, Mail,
} from 'lucide-react';
import type { HubData, HubFaqSuggestion } from '@/lib/db';
import type { HubDomainStatus } from '@/lib/studio';

type ProjectLite = {
  businessName: string;
  siteUrl: string | null;
  hubEnabled: boolean;
  hubUrl: string | null;
};

const CNAME_TARGET = 'cname.vercel-dns.com';

const emptyHub = (p: ProjectLite): HubData => ({
  businessName: p.businessName,
  description: '',
  postalCode: '',
  address: '',
  tel: '',
  businessHours: '',
  homepageUrl: p.siteUrl || '',
  sameAs: p.siteUrl ? [p.siteUrl] : [],
  faq: [],
  showColumns: true,
  customDomain: '',
});

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

export default function HubClient({
  project,
  initialData,
  initialSuggestions,
}: {
  project: ProjectLite;
  initialData: HubData | null;
  initialSuggestions: HubFaqSuggestion[];
}) {
  const [enabled, setEnabled] = useState(project.hubEnabled);
  const [hubUrl, setHubUrl] = useState(project.hubUrl);
  const [data, setData] = useState<HubData>(initialData ?? emptyHub(project));
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [domainStatus, setDomainStatus] = useState<HubDomainStatus | null>(null);

  const homepageHost = useMemo(() => hostOf(data.homepageUrl || project.siteUrl || ''), [data.homepageUrl, project.siteUrl]);

  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const call = async (key: string, input: RequestInfo, init: RequestInit): Promise<Record<string, unknown> | null> => {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      const res = await fetch(input, init);
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error || '処理に失敗しました。');
        return null;
      }
      return json;
    } catch {
      setError('通信エラーが発生しました。');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const enable = async () => {
    const json = await call('enable', '/api/app/hub', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enable' }),
    });
    if (!json) return;
    const hub = json.hub as { enabled: boolean; url: string; data: HubData };
    setEnabled(true);
    setHubUrl(hub.url);
    setData(hub.data);
    if (json.domain !== undefined) setDomainStatus(json.domain as HubDomainStatus | null);
    setNotice('ハブページを公開しました。下のスニペットを既存HPに設置してください。');
  };

  const save = async () => {
    const json = await call('save', '/api/app/hub', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', data }),
    });
    if (!json) return;
    const hub = json.hub as { url: string | null; data: HubData };
    if (hub.url) setHubUrl(hub.url);
    setData(hub.data);
    if (json.domain !== undefined) setDomainStatus(json.domain as HubDomainStatus | null);
    setNotice(enabled ? '保存し、公開ページへ反映しました。' : '保存しました（ハブページは未公開です）。');
  };

  const disable = async () => {
    if (!confirm('ハブページを非公開にします。よろしいですか？')) return;
    const json = await call('disable', '/api/app/hub', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disable' }),
    });
    if (!json) return;
    setEnabled(false);
    setNotice('ハブページを非公開にしました。');
  };

  const generateSuggestions = async () => {
    const json = await call('gen', '/api/app/hub/faq', { method: 'POST' });
    if (!json) return;
    setSuggestions(json.suggestions as HubFaqSuggestion[]);
    setNotice('Q&A案を生成しました。内容を確認して「承認して追記」を押すとハブに掲載されます。');
  };

  const judgeSuggestion = async (id: number, status: 'approved' | 'dismissed') => {
    const json = await call(`sugg-${id}`, '/api/app/hub/faq', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestionId: id, status }),
    });
    if (!json) return;
    setSuggestions(json.suggestions as HubFaqSuggestion[]);
    if (json.hubData) setData(json.hubData as HubData);
    if (status === 'approved') setNotice('FAQをハブページに追記しました。');
  };

  const checkDomain = async () => {
    const json = await call('checkDomain', '/api/app/hub', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'checkDomain' }),
    });
    if (!json) return;
    const st = json.domain as HubDomainStatus | null;
    setDomainStatus(st);
    if (!st) setNotice('カスタムドメインは未設定です。');
    else if (st.verified) setNotice(`DNS設定が確認できました。https://${st.domain}/ で公開されています。`);
    else setNotice('DNSはまだ反映されていません。設定後、最大48時間かかる場合があります。');
  };

  const linkSnippet = hubUrl
    ? `<a href="${hubUrl}">よくある質問・店舗情報｜${data.businessName || project.businessName}</a>`
    : '';

  const customDomain = data.customDomain || '';
  const domainParts = customDomain.split('.');
  const dnsSub = domainParts.length > 2 ? domainParts[0] : 'faq';
  const dnsHost = domainParts.length > 2 ? domainParts.slice(1).join('.') : (homepageHost || 'example.com');
  const cnameValue =
    domainStatus?.requiredDns?.find((r) => r.type.toUpperCase() === 'CNAME')?.value || CNAME_TARGET;
  const dnsTemplate = `ご担当者様

お世話になっております。${data.businessName || project.businessName}です。
現在ご管理いただいているドメイン「${dnsHost}」のDNSに、以下のレコードを1行追加していただきたく、ご対応をお願いできますでしょうか。

■ 追加するDNSレコード（1件のみ）
・種別: CNAME
・ホスト名: ${dnsSub}（フルネーム: ${dnsSub}.${dnsHost}）
・値（参照先）: ${cnameValue}

■ 補足（影響範囲について）
・新しいサブドメイン「${dnsSub}.${dnsHost}」を追加するだけの作業です
・既存のWebサイト本体（${dnsHost} / www.${dnsHost}）の表示には一切変更・影響はありません
・メール（MXレコード等）にも変更・影響はありません
・反映には数分〜最大48時間ほどかかる場合があります

追加が完了しましたら、ご一報いただけますと幸いです。
お手数をおかけしますが、よろしくお願いいたします。`;

  const inputCls = 'w-full text-sm font-bold bg-[#faf7f9] border border-[#eadfe7] rounded-xl px-3 py-2 outline-none focus:border-[var(--opt-accent)]';
  const labelCls = 'block text-[11px] font-black opacity-50 mb-1';
  const openSuggestions = suggestions.filter((s) => s.status === 'open');

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-2xl px-4 py-3">{error}</div>
      )}
      {notice && (
        <div className="bg-[#f5e6f0] border border-[#eadfe7] text-xs font-bold rounded-2xl px-4 py-3">{notice}</div>
      )}

      {/* 公開状態 */}
      <div className="bg-white rounded-3xl border border-[#eadfe7] p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white"
              style={{ background: enabled ? 'var(--opt-accent)' : '#c9bcc5' }}
            >
              <Globe size={18} />
            </div>
            <div>
              <p className="text-sm font-black">{enabled ? 'ハブページは公開中です' : 'ハブページは未公開です'}</p>
              <p className="text-[11px] font-bold opacity-50">
                {enabled
                  ? '内容を編集したら「保存して反映」で公開ページが更新されます。'
                  : '有効化すると、事業者情報と初期FAQ（AIに言及されなかった質問から自動生成）でページを作成します。'}
              </p>
            </div>
          </div>
          {enabled ? (
            <button onClick={disable} disabled={busy !== null} className="text-[11px] font-bold px-3 py-1.5 rounded-full opacity-40 hover:opacity-80 border border-[#eadfe7]">
              非公開にする
            </button>
          ) : (
            <button
              onClick={enable}
              disabled={busy !== null}
              className="flex items-center gap-2 text-xs font-black px-5 py-2.5 rounded-full text-white disabled:opacity-60"
              style={{ background: 'var(--opt-accent)' }}
            >
              {busy === 'enable' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {busy === 'enable' ? '生成中…（1分ほどかかります）' : 'ハブページを作成して公開する'}
            </button>
          )}
        </div>

        {enabled && hubUrl && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <code className="text-xs font-bold bg-[#faf7f9] border border-[#eadfe7] rounded-xl px-3 py-2 break-all">{hubUrl}</code>
            <button onClick={() => copyText('url', hubUrl)} className="flex items-center gap-1 text-[11px] font-black px-3 py-1.5 rounded-full border border-[#eadfe7] hover:bg-[#faf7f9]">
              {copied === 'url' ? <Check size={12} /> : <Copy size={12} />} URLをコピー
            </button>
            <a href={hubUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-black px-3 py-1.5 rounded-full border border-[#eadfe7] hover:bg-[#faf7f9]">
              <ExternalLink size={12} /> 開く
            </a>
          </div>
        )}
      </div>

      {/* 既存HPへのリンク設置（モデルAの紐付け） */}
      {enabled && hubUrl && (
        <div className="bg-white rounded-3xl border border-[#eadfe7] p-6">
          <div className="flex items-center gap-2 mb-2">
            <Link2 size={16} style={{ color: 'var(--opt-accent)' }} />
            <h2 className="text-sm font-black">既存HPに貼るリンク（必須）</h2>
          </div>
          <p className="text-[11px] font-bold opacity-50 mb-3">
            既存HPのフッターやナビに、このテキストリンクを1つ設置してください。既存HP⇄ハブの双方向リンクが、AIとGoogleに「同一事業者」だと伝える紐付けになります（ハブ→既存HPのリンクは自動で入っています）。
          </p>
          <div className="flex items-start gap-2 flex-wrap">
            <code className="flex-1 min-w-[240px] text-xs font-bold bg-[#faf7f9] border border-[#eadfe7] rounded-xl px-3 py-2 break-all">{linkSnippet}</code>
            <button onClick={() => copyText('snippet', linkSnippet)} className="flex items-center gap-1 text-[11px] font-black px-3 py-1.5 rounded-full text-white" style={{ background: 'var(--opt-accent)' }}>
              {copied === 'snippet' ? <Check size={12} /> : <Copy size={12} />} コピー
            </button>
          </div>
        </div>
      )}

      {/* FAQ追記の提案（承認制） */}
      {enabled && (
        <div className="bg-white rounded-3xl border border-[#eadfe7] p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
            <div>
              <h2 className="text-sm font-black">FAQ追記の提案</h2>
              <p className="text-[11px] font-bold opacity-50 mt-0.5">
                観測で「AIに言及されなかった質問」に答えるQ&amp;A案を生成します。承認したものだけがハブページに追記されます（自動追記はしません）。
              </p>
            </div>
            <button
              onClick={generateSuggestions}
              disabled={busy !== null}
              className="flex items-center gap-2 text-[11px] font-black px-4 py-2 rounded-full text-white disabled:opacity-60"
              style={{ background: 'var(--opt-accent)' }}
            >
              {busy === 'gen' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Q&amp;A案を生成
            </button>
          </div>
          {openSuggestions.length === 0 ? (
            <p className="text-xs font-bold opacity-40 py-3">未承認の提案はありません。</p>
          ) : (
            <div className="space-y-3 mt-3">
              {openSuggestions.map((s) => (
                <div key={s.id} className="border border-[#eadfe7] rounded-2xl p-4">
                  <p className="text-sm font-black">Q. {s.question}</p>
                  <p className="text-xs font-bold opacity-70 mt-1 whitespace-pre-wrap">A. {s.answer}</p>
                  {s.sourcePrompt && (
                    <p className="text-[10px] font-bold opacity-40 mt-2">元になったAIへの質問: {s.sourcePrompt}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => judgeSuggestion(s.id, 'approved')}
                      disabled={busy !== null}
                      className="flex items-center gap-1 text-[11px] font-black px-3 py-1.5 rounded-full text-white disabled:opacity-60"
                      style={{ background: 'var(--opt-accent)' }}
                    >
                      {busy === `sugg-${s.id}` ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} 承認して追記
                    </button>
                    <button
                      onClick={() => judgeSuggestion(s.id, 'dismissed')}
                      disabled={busy !== null}
                      className="flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded-full opacity-40 hover:opacity-80"
                    >
                      <X size={12} /> 却下
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* コンテンツ編集 */}
      <div className="bg-white rounded-3xl border border-[#eadfe7] p-6">
        <h2 className="text-sm font-black mb-1">ハブページの内容</h2>
        <p className="text-[11px] font-bold opacity-50 mb-4">
          店名・住所・電話番号（NAP）は既存HPやGoogleビジネスプロフィールと一字一句そろえてください。表記ゆれはAIの信頼度を下げます。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>事業者名（NAPのN・必須）</label>
            <input className={inputCls} value={data.businessName} onChange={(e) => setData({ ...data, businessName: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>電話番号（NAPのP）</label>
            <input className={inputCls} value={data.tel} onChange={(e) => setData({ ...data, tel: e.target.value })} placeholder="03-1234-5678" />
          </div>
          <div>
            <label className={labelCls}>郵便番号</label>
            <input className={inputCls} value={data.postalCode} onChange={(e) => setData({ ...data, postalCode: e.target.value })} placeholder="150-0001" />
          </div>
          <div>
            <label className={labelCls}>住所（NAPのA）</label>
            <input className={inputCls} value={data.address} onChange={(e) => setData({ ...data, address: e.target.value })} placeholder="東京都渋谷区…" />
          </div>
          <div>
            <label className={labelCls}>営業時間</label>
            <input className={inputCls} value={data.businessHours} onChange={(e) => setData({ ...data, businessHours: e.target.value })} placeholder="10:00〜19:00（水曜定休）" />
          </div>
          <div>
            <label className={labelCls}>既存ホームページURL（紐付け先）</label>
            <input className={inputCls} value={data.homepageUrl} onChange={(e) => setData({ ...data, homepageUrl: e.target.value })} placeholder="https://…" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>紹介文（ページ上部に表示）</label>
            <textarea className={`${inputCls} min-h-[64px]`} value={data.description} onChange={(e) => setData({ ...data, description: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>sameAs（既存HP・Googleビジネスプロフィール・SNS等のURL。1行に1つ）</label>
            <textarea
              className={`${inputCls} min-h-[64px]`}
              value={data.sameAs.join('\n')}
              onChange={(e) => setData({ ...data, sameAs: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
              placeholder={'https://example.com\nhttps://maps.google.com/…'}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 mt-4 text-xs font-bold">
          <input type="checkbox" checked={data.showColumns} onChange={(e) => setData({ ...data, showColumns: e.target.checked })} />
          Studioに送稿したコラム記事の一覧をハブページに表示する
        </label>

        {/* FAQ編集 */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black opacity-70">FAQ（{data.faq.length}件）</h3>
            <button
              onClick={() => setData({ ...data, faq: [...data.faq, { q: '', a: '' }] })}
              className="flex items-center gap-1 text-[11px] font-black px-3 py-1.5 rounded-full border border-[#eadfe7] hover:bg-[#faf7f9]"
            >
              <Plus size={12} /> 追加
            </button>
          </div>
          <div className="space-y-3">
            {data.faq.map((f, i) => (
              <div key={i} className="border border-[#eadfe7] rounded-2xl p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <input
                      className={inputCls}
                      value={f.q}
                      placeholder="質問"
                      onChange={(e) => setData({ ...data, faq: data.faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })}
                    />
                    <textarea
                      className={`${inputCls} min-h-[56px]`}
                      value={f.a}
                      placeholder="回答（結論先出し・2〜4文）"
                      onChange={(e) => setData({ ...data, faq: data.faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })}
                    />
                  </div>
                  <button
                    onClick={() => setData({ ...data, faq: data.faq.filter((_, j) => j !== i) })}
                    className="opacity-40 hover:opacity-80 p-1 shrink-0"
                    title="削除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {data.faq.length === 0 && <p className="text-xs font-bold opacity-40">FAQはまだありません。「Q&amp;A案を生成」から追加するか、手動で追加してください。</p>}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={save}
            disabled={busy !== null}
            className="flex items-center gap-2 text-xs font-black px-5 py-2.5 rounded-full text-white disabled:opacity-60"
            style={{ background: 'var(--opt-accent)' }}
          >
            {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {enabled ? '保存して公開ページへ反映' : '保存する'}
          </button>
        </div>
      </div>

      {/* B昇格: 独自サブドメイン（申請 + DNS依頼文テンプレ） */}
      <div className="bg-white rounded-3xl border border-[#eadfe7] p-6">
        <div className="flex items-center gap-2 mb-2">
          <Mail size={16} style={{ color: 'var(--opt-accent)' }} />
          <h2 className="text-sm font-black">オプション: 独自サブドメインで公開する（DNS1行）</h2>
        </div>
        <p className="text-[11px] font-bold opacity-50 mb-1">
          ハブページをお客様ドメインのサブドメイン（例: faq.{homepageHost || 'あなたのドメイン'}）で公開できます。
          ①下にサブドメインを入力して「申請して保存」→②制作会社・ドメイン管理者へ依頼文を送付→③反映後「DNS設定状況を確認」で完了です。
          既存サイトやメールへの影響はありません。
        </p>
        <p className="text-[11px] font-bold opacity-50 mb-4">
          補足: 標準の当社ドメイン公開ではハブは顧客のGoogle Search Consoleに表示されませんが、サブドメイン公開ならドメインプロパティで自動的に計測対象になります。
        </p>

        <div className="flex items-center gap-2 flex-wrap mb-3">
          <label className="text-[11px] font-black opacity-50 shrink-0">カスタムドメイン</label>
          <input
            className={`${inputCls} max-w-[280px]`}
            value={data.customDomain}
            placeholder={`faq.${homepageHost || 'example.com'}`}
            onChange={(e) =>
              setData({ ...data, customDomain: e.target.value.trim().toLowerCase().replace(/[^a-z0-9.-]/g, '') })
            }
          />
          <button
            onClick={save}
            disabled={busy !== null || !enabled}
            className="flex items-center gap-1 text-[11px] font-black px-4 py-2 rounded-full text-white disabled:opacity-50"
            style={{ background: 'var(--opt-accent)' }}
            title={enabled ? '' : '先にハブページを公開してください'}
          >
            {busy === 'save' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} 申請して保存
          </button>
          <button
            onClick={checkDomain}
            disabled={busy !== null || !enabled}
            className="flex items-center gap-1 text-[11px] font-bold px-3 py-2 rounded-full border border-[#eadfe7] hover:bg-[#faf7f9] disabled:opacity-50"
          >
            {busy === 'checkDomain' ? <Loader2 size={12} className="animate-spin" /> : null} DNS設定状況を確認
          </button>
        </div>

        {domainStatus && (
          <div
            className={`text-[11px] font-bold rounded-2xl px-4 py-3 mb-3 border ${
              domainStatus.verified
                ? 'bg-[#eaf6f0] border-[#bfe3d2] text-[#0d7a54]'
                : 'bg-[#fdf3df] border-[#f0dcb0] text-[#8a6410]'
            }`}
          >
            {domainStatus.verified ? (
              <>設定完了: <a className="underline" href={`https://${domainStatus.domain}/`} target="_blank" rel="noopener noreferrer">https://{domainStatus.domain}/</a> で公開中です。</>
            ) : (
              <>DNS反映待ち: {domainStatus.domain} はまだ確認できていません。下の依頼文でCNAME追加を依頼してください（反映まで最大48時間）。</>
            )}
            {domainStatus.error ? <span className="block opacity-70 mt-1">{domainStatus.error}</span> : null}
          </div>
        )}

        <textarea readOnly className={`${inputCls} min-h-[220px] text-xs leading-relaxed`} value={dnsTemplate} />
        <div className="mt-3">
          <button
            onClick={() => copyText('dns', dnsTemplate)}
            className="flex items-center gap-1 text-[11px] font-black px-4 py-2 rounded-full text-white"
            style={{ background: 'var(--opt-accent)' }}
          >
            {copied === 'dns' ? <Check size={12} /> : <Copy size={12} />} 依頼文をコピー
          </button>
        </div>
      </div>
    </div>
  );
}
