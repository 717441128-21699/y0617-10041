import nodemailer from 'nodemailer';
import { config } from '../config';

class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  private static getTransporter(): nodemailer.Transporter {
    if (!EmailService.transporter) {
      EmailService.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      });
    }
    return EmailService.transporter;
  }

  static async sendInvitation(
    to: string,
    tenantName: string,
    invitationToken: string,
    inviterName: string
  ): Promise<void> {
    const invitationUrl = `https://app.${config.baseDomain}/invite?token=${invitationToken}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited to join ${tenantName}</h2>
        <p>Hi there,</p>
        <p>${inviterName} has invited you to join their team on ${tenantName}.</p>
        <p>Click the button below to accept the invitation:</p>
        <a href="${invitationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">Accept Invitation</a>
        <p>If the button doesn't work, copy and paste this URL into your browser:</p>
        <p><code>${invitationUrl}</code></p>
        <p>This invitation will expire in 7 days.</p>
        <p>Best regards,<br>The ${tenantName} Team</p>
      </div>
    `;

    await EmailService.sendEmail({
      to,
      subject: `You're invited to join ${tenantName}`,
      html,
    });
  }

  static async sendInvoice(
    to: string,
    tenantName: string,
    invoiceId: string,
    amount: number,
    period: string
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Invoice for ${tenantName}</h2>
        <p>Your invoice for ${period} is ready.</p>
        <p><strong>Amount Due:</strong> $${amount.toFixed(2)}</p>
        <p><strong>Invoice ID:</strong> ${invoiceId}</p>
        <p>Please log in to your account to view and pay the invoice.</p>
        <p>Best regards,<br>The Billing Team</p>
      </div>
    `;

    await EmailService.sendEmail({
      to,
      subject: `New Invoice for ${tenantName} - $${amount.toFixed(2)}`,
      html,
    });
  }

  private static async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    if (!config.smtp.host) {
      console.log('[Email] Would send email:', params);
      return;
    }

    const transporter = EmailService.getTransporter();
    await transporter.sendMail({
      from: config.smtp.user,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
  }
}

export default EmailService;
