const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;

type TicketEmailInput = {
  to: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  quantity: number;
  totalAmount: number;
  ticketCode: string;
  ticketUrl: string;
};

type CancellationEmailInput = {
  to: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  quantity: number;
  totalAmount: number;
  refundStatus: "succeeded" | "pending";
  cancelledAt: string;
};

type OrganizerPurchaseNotificationInput = {
  to: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  quantity: number;
  totalAmount: number;
  customerEmail?: string;
  ticketCode: string;
};

function getRefundStatusLabel(status: "succeeded" | "pending") {
  return status === "succeeded" ? "返金完了" : "返金処理中";
}

export function canSendPurchaseEmail() {
  return Boolean(resendApiKey && emailFrom);
}

export async function sendPurchaseConfirmationEmail(input: TicketEmailInput) {
  if (!resendApiKey || !emailFrom) {
    return { ok: false as const, error: "メール送信設定が未完了です。" };
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; line-height: 1.6;">
      <h1 style="font-size: 24px; margin-bottom: 16px;">購入ありがとうございます</h1>
      <p style="margin-bottom: 16px;">以下の内容でチケット購入を受け付けました。</p>
      <div style="border: 1px solid #e5e7eb; border-radius: 16px; padding: 20px; margin-bottom: 20px;">
        <p style="margin: 0 0 8px;"><strong>イベント:</strong> ${escapeHtml(input.eventTitle)}</p>
        <p style="margin: 0 0 8px;"><strong>日時:</strong> ${escapeHtml(input.eventDate)}</p>
        <p style="margin: 0 0 8px;"><strong>場所:</strong> ${escapeHtml(input.eventLocation)}</p>
        <p style="margin: 0 0 8px;"><strong>枚数:</strong> ${input.quantity}</p>
        <p style="margin: 0 0 8px;"><strong>金額:</strong> ¥${input.totalAmount.toLocaleString()}</p>
      </div>
      <div style="border: 2px dashed #111827; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 20px;">
        <p style="margin: 0 0 8px; color: #6b7280;">受付コード</p>
        <p style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 0.3em;">${escapeHtml(input.ticketCode)}</p>
      </div>
      <p style="margin: 0 0 16px;">当日はこの受付コードを提示してください。</p>
      <a href="${escapeHtml(input.ticketUrl)}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 12px; font-weight: 600;">
        チケットを見る
      </a>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [input.to],
      subject: `【POSH JAPAN】${input.eventTitle} の購入確認`,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false as const, error: text || "メール送信に失敗しました。" };
  }

  return { ok: true as const };
}

export async function sendPurchaseCancellationEmail(input: CancellationEmailInput) {
  if (!resendApiKey || !emailFrom) {
    return { ok: false as const, error: "メール送信設定が未完了です。" };
  }

  const refundStatusLabel = getRefundStatusLabel(input.refundStatus);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; line-height: 1.6;">
      <h1 style="font-size: 24px; margin-bottom: 16px;">キャンセルを受け付けました</h1>
      <p style="margin-bottom: 16px;">以下のチケットはキャンセル済みになりました。返金状態もあわせてご案内します。</p>
      <div style="border: 1px solid #e5e7eb; border-radius: 16px; padding: 20px; margin-bottom: 20px;">
        <p style="margin: 0 0 8px;"><strong>イベント:</strong> ${escapeHtml(input.eventTitle)}</p>
        <p style="margin: 0 0 8px;"><strong>日時:</strong> ${escapeHtml(input.eventDate)}</p>
        <p style="margin: 0 0 8px;"><strong>場所:</strong> ${escapeHtml(input.eventLocation)}</p>
        <p style="margin: 0 0 8px;"><strong>枚数:</strong> ${input.quantity}</p>
        <p style="margin: 0 0 8px;"><strong>返金予定額:</strong> ¥${input.totalAmount.toLocaleString()}</p>
        <p style="margin: 0 0 8px;"><strong>返金状態:</strong> ${refundStatusLabel}</p>
        <p style="margin: 0;"><strong>キャンセル受付時刻:</strong> ${escapeHtml(input.cancelledAt)}</p>
      </div>
      <p style="margin: 0 0 8px;">返金処理の反映タイミングはカード会社により異なります。</p>
      <p style="margin: 0; color: #6b7280;">Stripe上の返金状態: ${refundStatusLabel}</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [input.to],
      subject: `【POSH JAPAN】${input.eventTitle} のキャンセル確認（${refundStatusLabel}）`,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false as const, error: text || "メール送信に失敗しました。" };
  }

  return { ok: true as const };
}

export async function sendOrganizerPurchaseNotificationEmail(
  input: OrganizerPurchaseNotificationInput,
) {
  if (!resendApiKey || !emailFrom) {
    return { ok: false as const, error: "メール送信設定が未完了です。" };
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; line-height: 1.6;">
      <h1 style="font-size: 24px; margin-bottom: 16px;">新しい購入が入りました</h1>
      <div style="border: 1px solid #e5e7eb; border-radius: 16px; padding: 20px; margin-bottom: 20px;">
        <p style="margin: 0 0 8px;"><strong>イベント:</strong> ${escapeHtml(input.eventTitle)}</p>
        <p style="margin: 0 0 8px;"><strong>日時:</strong> ${escapeHtml(input.eventDate)}</p>
        <p style="margin: 0 0 8px;"><strong>場所:</strong> ${escapeHtml(input.eventLocation)}</p>
        <p style="margin: 0 0 8px;"><strong>枚数:</strong> ${input.quantity}</p>
        <p style="margin: 0 0 8px;"><strong>金額:</strong> ¥${input.totalAmount.toLocaleString()}</p>
        <p style="margin: 0 0 8px;"><strong>購入者メール:</strong> ${escapeHtml(input.customerEmail ?? "未入力")}</p>
        <p style="margin: 0;"><strong>受付コード:</strong> ${escapeHtml(input.ticketCode)}</p>
      </div>
      <p style="margin: 0;">管理画面から受付やCSV確認ができます。</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [input.to],
      subject: `【POSH JAPAN】${input.eventTitle} に新規購入が入りました`,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false as const, error: text || "メール送信に失敗しました。" };
  }

  return { ok: true as const };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
