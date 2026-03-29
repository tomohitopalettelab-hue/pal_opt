/**
 * 通知送信ユーティリティ
 * Email (SMTP) および LINE Messaging API に対応
 */

type NotificationPayload = {
  type: 'approval_request' | 'approved' | 'rejected' | 'published' | 'failed';
  postTitle: string;
  postId: string;
  paletteId: string;
  reason?: string;
};

// ── Email 送信 ──────────────────────────────────────────────────────────────

const sendEmail = async (to: string, payload: NotificationPayload): Promise<void> => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'noreply@palette-system.com';

  if (!host || !user || !pass) {
    console.warn('SMTP設定が不完全です。メール通知をスキップします。');
    return;
  }

  const subjectMap: Record<string, string> = {
    approval_request: `[Pal Opt] 承認申請: ${payload.postTitle}`,
    approved: `[Pal Opt] 承認完了: ${payload.postTitle}`,
    rejected: `[Pal Opt] 差し戻し: ${payload.postTitle}`,
    published: `[Pal Opt] 投稿完了: ${payload.postTitle}`,
    failed: `[Pal Opt] 投稿失敗: ${payload.postTitle}`,
  };

  const bodyMap: Record<string, string> = {
    approval_request: `投稿「${payload.postTitle}」の承認申請がありました。\n管理画面から確認してください。`,
    approved: `投稿「${payload.postTitle}」が承認されました。`,
    rejected: `投稿「${payload.postTitle}」が差し戻されました。\n${payload.reason ? `理由: ${payload.reason}` : ''}`,
    published: `投稿「${payload.postTitle}」が正常に公開されました。`,
    failed: `投稿「${payload.postTitle}」の公開に失敗しました。管理画面で詳細を確認してください。`,
  };

  try {
    // Dynamic import to avoid bundling issues in Next.js edge
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to,
      subject: subjectMap[payload.type] || `[Pal Opt] 通知`,
      text: bodyMap[payload.type] || '通知があります。',
    });
  } catch (error) {
    console.error('メール送信エラー:', error);
  }
};

// ── LINE 送信 ───────────────────────────────────────────────────────────────

const sendLineMessage = async (userId: string, payload: NotificationPayload): Promise<void> => {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.warn('LINE_CHANNEL_ACCESS_TOKEN が未設定です。LINE通知をスキップします。');
    return;
  }

  const messageMap: Record<string, string> = {
    approval_request: `📝 承認申請\n\n投稿「${payload.postTitle}」の承認申請がありました。管理画面から確認してください。`,
    approved: `✅ 承認完了\n\n投稿「${payload.postTitle}」が承認されました。`,
    rejected: `🔄 差し戻し\n\n投稿「${payload.postTitle}」が差し戻されました。${payload.reason ? `\n理由: ${payload.reason}` : ''}`,
    published: `🎉 投稿完了\n\n投稿「${payload.postTitle}」が正常に公開されました。`,
    failed: `⚠️ 投稿失敗\n\n投稿「${payload.postTitle}」の公開に失敗しました。`,
  };

  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: messageMap[payload.type] || '通知があります。' }],
      }),
    });
  } catch (error) {
    console.error('LINE送信エラー:', error);
  }
};

// ── 統合送信 ────────────────────────────────────────────────────────────────

export const sendNotification = async (
  settings: { notificationType: string | null; notificationEmail: string | null; lineUserId: string | null },
  payload: NotificationPayload,
): Promise<void> => {
  if (!settings.notificationType) return;

  if (settings.notificationType === 'email' && settings.notificationEmail) {
    await sendEmail(settings.notificationEmail, payload);
  } else if (settings.notificationType === 'line' && settings.lineUserId) {
    await sendLineMessage(settings.lineUserId, payload);
  }
};
