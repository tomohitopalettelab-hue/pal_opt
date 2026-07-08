'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RotateCcw } from 'lucide-react';

/**
 * 顧客プロジェクトのリセット。誤爆防止のため palette_id の入力一致を必須にする。
 */
export default function ResetButton({ projectId, paletteId }: { projectId: number; paletteId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    const confirm = window.prompt(
      `${paletteId} のプロジェクトをリセットします。\n計測データ・診断・改善タスク・通知がすべて削除され、顧客は再オンボーディングからやり直しになります（アカウント・契約は残ります）。\n\n確認のため palette_id「${paletteId}」を入力してください:`,
    );
    if (confirm === null) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/projects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, confirmPaletteId: confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        window.alert(data?.error || 'リセットに失敗しました。');
      } else {
        router.refresh();
      }
    } catch {
      window.alert('通信エラーが発生しました。');
    }
    setBusy(false);
  };

  return (
    <button
      onClick={reset}
      disabled={busy}
      className="flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
    >
      {busy ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
      リセット
    </button>
  );
}
