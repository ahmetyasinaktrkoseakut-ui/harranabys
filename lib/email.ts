/**
 * Harran Üniversitesi İlahiyat Fakültesi Akreditasyon Bilgi Yönetim Sistemi (ABYS)
 * Kurumsal E-Posta Gönderim Modülü
 * - Gmail SMTP (nodemailer) & Resend REST API Fallback
 * - XSS / HTML sanitization
 * - 8 saniye zaman aşımı (Timeout)
 * - Fail-Safe / Graceful Degradation
 */

import nodemailer from 'nodemailer';

interface SendSingleEmailParams {
  to: string;
  subject: string;
  html: string;
}

interface BatchEmailItem {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  success: boolean;
  skipped?: boolean;
  id?: string;
  error?: string;
}

const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_BATCH_URL = 'https://api.resend.com/emails/batch';
const TIMEOUT_MS = 8000;

/**
 * XSS ve HTML Enjeksiyonu Engelleme
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEmailConfig() {
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || (gmailUser ? `"Harran İlahiyat ABYS" <${gmailUser}>` : 'Harran İlahiyat Akreditasyon <onboarding@resend.dev>');
  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return { gmailUser, gmailPass, apiKey, from, appUrl };
}

function getGmailTransporter() {
  const { gmailUser, gmailPass } = getEmailConfig();
  if (!gmailUser || !gmailPass) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });
}

/**
 * Tekil E-Posta Gönderici (Özdeğerlendirme Raporu Ret/Revizyon Bildirimi)
 */
export async function sendSingleEmail({ to, subject, html }: SendSingleEmailParams): Promise<SendEmailResult> {
  const { gmailUser, apiKey, from } = getEmailConfig();
  const transporter = getGmailTransporter();

  if (!to || !to.includes('@')) {
    return { success: false, error: 'Geçersiz alıcı e-posta adresi.' };
  }

  // 1. Öncelik: Gmail SMTP (nodemailer)
  if (transporter && gmailUser) {
    try {
      const info = await transporter.sendMail({
        from,
        to: to.trim(),
        subject: subject.trim(),
        html,
      });
      return { success: true, id: info.messageId };
    } catch (err: any) {
      console.warn('[EMAIL] Gmail SMTP gönderim hatası:', err?.message || err);
      if (!apiKey) {
        return { success: false, error: err?.message || 'Gmail SMTP hatası' };
      }
    }
  }

  // 2. Öncelik: Resend API (Fallback)
  if (apiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to.trim()],
          subject: subject.trim(),
          html,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.warn('[EMAIL] Resend API hatası:', data);
        return { success: false, error: data?.message || 'E-posta gönderilemedi.' };
      }

      return { success: true, id: data?.id };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === 'AbortError') {
        console.warn('[EMAIL] İstek zaman aşımına uğradı (8 saniye).');
        return { success: false, error: 'Zaman aşımı' };
      }
      console.warn('[EMAIL] E-posta gönderiminde hata:', err?.message || err);
      return { success: false, error: err?.message || 'Ağ hatası' };
    }
  }

  console.warn('[EMAIL] Ne GMAIL ne de RESEND yapılandırması bulundu. E-posta gönderimi güvenli şekilde atlandı.');
  return { success: false, skipped: true, error: 'E-posta sağlayıcı yapılandırılmamış' };
}

/**
 * Toplu E-Posta Gönderici (Duyurular için)
 */
export async function sendBatchEmails(items: BatchEmailItem[]): Promise<{ success: boolean; count: number; error?: string }> {
  const { gmailUser, apiKey, from } = getEmailConfig();
  const transporter = getGmailTransporter();

  if (!items || items.length === 0) {
    return { success: true, count: 0 };
  }

  const validItems = items.filter(it => it.to && it.to.includes('@'));
  if (validItems.length === 0) {
    return { success: false, count: 0, error: 'Geçerli alıcı bulunamadı.' };
  }

  // 1. Öncelik: Gmail SMTP (Sıralı / kontrollü gönderim)
  if (transporter && gmailUser) {
    let totalSent = 0;
    for (const item of validItems) {
      try {
        await transporter.sendMail({
          from,
          to: item.to.trim(),
          subject: item.subject.trim(),
          html: item.html,
        });
        totalSent++;
      } catch (err: any) {
        console.warn(`[EMAIL] Gmail toplu gönderim hatası (${item.to}):`, err?.message || err);
      }
    }
    return { success: totalSent > 0, count: totalSent };
  }

  // 2. Öncelik: Resend Batch API
  if (apiKey) {
    let totalSent = 0;
    const CHUNK_SIZE = 100;

    for (let i = 0; i < validItems.length; i += CHUNK_SIZE) {
      const chunk = validItems.slice(i, i + CHUNK_SIZE).map(item => ({
        from,
        to: [item.to.trim()],
        subject: item.subject.trim(),
        html: item.html,
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await fetch(RESEND_BATCH_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          totalSent += chunk.length;
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn(`[EMAIL] Resend batch gönderim hatası (parça ${i / CHUNK_SIZE + 1}):`, errData);
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        console.warn(`[EMAIL] Resend batch gönderim hatası:`, err?.message || err);
      }
    }

    return { success: totalSent > 0, count: totalSent };
  }

  console.warn('[EMAIL] Ne GMAIL ne de RESEND yapılandırması bulundu. Toplu e-posta gönderimi atlandı.');
  return { success: false, count: 0, error: 'E-posta sağlayıcı yapılandırılmamış' };
}

/**
 * ÖDR Raporu Ret/Revizyon Bildirim Şablonu
 */
export function createRejectionEmailHtml({
  hocaAdi,
  olcutKodu,
  olcutAdi,
  redNedeni,
  appUrl,
}: {
  hocaAdi: string;
  olcutKodu: string;
  olcutAdi: string;
  redNedeni: string;
  appUrl: string;
}): string {
  const loginUrl = `${appUrl}/tr/login`;
  const safeHocaAdi = escapeHtml(hocaAdi);
  const safeOlcutKodu = escapeHtml(olcutKodu);
  const safeOlcutAdi = escapeHtml(olcutAdi);
  const safeRedNedeni = escapeHtml(redNedeni);

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Özdeğerlendirme Raporu Revizyon Bildirimi</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Kurumsal Üst Bant -->
          <tr>
            <td style="background-color: #0f172a; padding: 20px 28px; text-align: left; border-bottom: 3px solid #0284c7;">
              <h1 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; line-height: 1.3;">
                Harran Üniversitesi
              </h1>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; font-weight: 500; line-height: 1.4;">
                İlahiyat Fakültesi Akreditasyon Bilgi Yönetim Sistemi (ABYS)
              </p>
            </td>
          </tr>

          <!-- İçerik Alanı -->
          <tr>
            <td style="padding: 32px 30px;">
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 18px; font-weight: 700;">
                Özdeğerlendirme Raporu Revizyon Bildirimi
              </h2>

              <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">
                Sayın <strong>${safeHocaAdi || 'Öğretim Elemanımız'}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">
                Sorumluluğunuzda bulunan <strong style="color: #0284c7;">${safeOlcutKodu} - ${safeOlcutAdi}</strong> alt ölçütüne ait Özdeğerlendirme Raporu, Akreditasyon Komisyonu / Başlık Koordinatörü tarafından incelenmiş ve <strong>revizyon yapılması amacıyla iade edilmiştir</strong>.
              </p>

              <!-- Revizyon Gerekçesi Kutusu -->
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; border-radius: 6px; padding: 14px 16px; margin: 0 0 24px 0;">
                <p style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; font-weight: 800; color: #991b1b; letter-spacing: 0.5px;">
                  Revizyon Gerekçesi:
                </p>
                <p style="margin: 0; font-size: 13px; color: #7f1d1d; white-space: pre-wrap;">${safeRedNedeni || 'Komisyon tarafından ek açıklama belirtilmemiştir.'}</p>
              </div>

              <p style="margin: 0 0 24px 0; font-size: 13.5px; color: #475569;">
                Lütfen sisteme giriş yaparak rapordaki eksiklikleri tamamlayınız ve raporunuzu yeniden onaya sununuz.
              </p>

              <!-- Buton -->
              <div style="text-align: center; margin: 28px 0;">
                <a href="${loginUrl}" style="background-color: #0284c7; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.3);">
                  Sisteme Giriş Yap ve Düzenle &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Alt Bilgi (Footer) -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 30px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #64748b;">
              <p style="margin: 0 0 4px 0;">
                Bu e-posta Harran İlahiyat Fakültesi ABYS Sistemi tarafından otomatik olarak gönderilmiştir.
              </p>
              <p style="margin: 0;">
                &copy; ${new Date().getFullYear()} Harran Üniversitesi İlahiyat Fakültesi Akreditasyon Komisyonu
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Genel Duyuru E-Posta Şablonu
 */
export function createAnnouncementEmailHtml({
  baslik,
  icerik,
  appUrl,
}: {
  baslik: string;
  icerik: string;
  appUrl: string;
}): string {
  const loginUrl = `${appUrl}/tr/login`;
  const safeBaslik = escapeHtml(baslik);
  const formattedContent = (icerik || '')
    .split(/\r?\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="margin: 0 0 12px 0; font-size: 14px; color: #334155; line-height: 1.6;">${escapeHtml(p)}</p>`)
    .join('');

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeBaslik}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Kurumsal Üst Bant -->
          <tr>
            <td style="background-color: #0f172a; padding: 20px 28px; text-align: left; border-bottom: 3px solid #0284c7;">
              <h1 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; line-height: 1.3;">
                Harran Üniversitesi
              </h1>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; font-weight: 500; line-height: 1.4;">
                İlahiyat Fakültesi Akreditasyon Bilgi Yönetim Sistemi (ABYS)
              </p>
            </td>
          </tr>

          <!-- İçerik Alanı -->
          <tr>
            <td style="padding: 32px 30px;">
              <div style="display: inline-block; background-color: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px;">
                Resmi Duyuru
              </div>

              <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 19px; font-weight: 800; line-height: 1.35;">
                ${safeBaslik}
              </h2>

              <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-bottom: 24px;">
                ${formattedContent}
              </div>

              <!-- Buton -->
              <div style="text-align: center; margin: 30px 0 10px 0;">
                <a href="${loginUrl}" style="background-color: #0284c7; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.3);">
                  Sisteme Giriş Yapın &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Alt Bilgi (Footer) -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 30px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #64748b;">
              <p style="margin: 0 0 4px 0;">
                Bu duyuru Harran İlahiyat Fakültesi Akreditasyon ve Kalite Komisyonu tarafından gönderilmiştir.
              </p>
              <p style="margin: 0;">
                &copy; ${new Date().getFullYear()} Harran Üniversitesi İlahiyat Fakültesi
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
