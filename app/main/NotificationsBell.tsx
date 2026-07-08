'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Megaphone, Swords, Link2 } from 'lucide-react';

type Notification = {
  id: number;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

const typeIcon = (type: string) => {
  if (type === 'first_mention') return <Megaphone size={14} style={{ color: 'var(--opt-accent)' }} />;
  if (type === 'new_competitor') return <Swords size={14} className="text-[#c98a10]" />;
  if (type === 'first_citation') return <Link2 size={14} className="text-[#1a9e6e]" />;
  return <Bell size={14} className="opacity-40" />;
};

const fmtDate = (s: string): string => {
  const ms = new Date(s).getTime();
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function NotificationsBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/app/notifications');
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success) {
          setItems(data.notifications ?? []);
          setUnread(Number(data.unread ?? 0));
        }
      } catch {
        /* ベルは補助UIなので失敗は無視 */
      }
    })();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      // 開いたら既読化（バッジを消す）
      setUnread(0);
      try {
        await fetch('/api/app/notifications', { method: 'PATCH' });
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        aria-label="通知"
        className="relative p-1.5 rounded-full hover:bg-[#f7f2f6] transition-colors"
      >
        <Bell size={17} className="opacity-70" />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black text-white flex items-center justify-center"
            style={{ background: 'var(--opt-accent)' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl border border-[#eadfe7] shadow-lg z-20">
          <p className="text-[11px] font-black opacity-50 px-4 pt-3 pb-2 border-b border-[#f2ecf1]">成果通知</p>
          {items.length === 0 ? (
            <p className="text-xs font-bold opacity-40 px-4 py-6 text-center">
              まだ通知はありません。
              <br />
              初言及・競合の新出現などの成果をお知らせします。
            </p>
          ) : (
            <div className="divide-y divide-[#f7f2f6]">
              {items.map((n) => (
                <div key={n.id} className={`px-4 py-3 ${n.readAt ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {typeIcon(n.type)}
                    <p className="text-xs font-black flex-1">{n.title}</p>
                    {!n.readAt && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--opt-accent)' }} />}
                  </div>
                  <p className="text-[11px] font-medium opacity-60 leading-relaxed">{n.body}</p>
                  <p className="text-[10px] font-bold opacity-30 mt-1">{fmtDate(n.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
