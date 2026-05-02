import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export type OtpPurpose = 'signup' | 'reset';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private transporterChecked = false;

  constructor(private readonly configService: ConfigService) {}

  private getTransporter(): Transporter | null {
    if (this.transporterChecked) {
      return this.transporter;
    }
    this.transporterChecked = true;

    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    const missing = [
      !host && 'SMTP_HOST',
      !user && 'SMTP_USER',
      !pass && 'SMTP_PASS',
    ].filter(Boolean);

    if (missing.length) {
      this.logger.warn(
        `SMTP not configured (missing: ${missing.join(', ')}). OTP emails will fall back to dev mode.`,
      );
      return null;
    }

    const port = Number(this.configService.get<string>('SMTP_PORT', '465'));
    const secure =
      this.configService.get<string>('SMTP_SECURE', port === 465 ? 'true' : 'false') ===
      'true';

    this.transporter = createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    return this.transporter;
  }

  async sendOtpEmail(
    to: string,
    code: string,
    purpose: OtpPurpose,
  ): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return false;
    }

    const fromAddress =
      this.configService.get<string>('SMTP_FROM') ??
      this.configService.get<string>('SMTP_USER') ??
      'no-reply@sonik.app';

    const subject =
      purpose === 'signup'
        ? 'Verify your Sonik account'
        : 'Reset your Sonik password';

    const heading =
      purpose === 'signup' ? 'Welcome to Sonik' : 'Reset your password';

    const intro =
      purpose === 'signup'
        ? 'Use the code below to verify your email and finish creating your account.'
        : 'Use the code below to reset your password. If you did not request this, you can ignore this email.';

    const text = [
      heading,
      '',
      intro,
      '',
      `Verification code: ${code}`,
      '',
      'This code expires in 10 minutes.',
      '',
      '— The Sonik team',
    ].join('\n');

    const html = `
      <div style="font-family: 'Inter', Arial, sans-serif; background:#0c0c12; padding:32px; color:#f5f5f8;">
        <div style="max-width:480px; margin:0 auto; background:#15151c; border:1px solid #26262f; border-radius:18px; padding:32px;">
          <h1 style="margin:0 0 12px; font-size:22px; color:#f5f5f8;">${heading}</h1>
          <p style="margin:0 0 20px; color:#a8a8b3; line-height:1.6;">${intro}</p>
          <div style="margin:24px 0; padding:18px 20px; background:#0c0c12; border:1px solid #26262f; border-radius:14px; text-align:center;">
            <div style="font-size:13px; letter-spacing:0.18em; text-transform:uppercase; color:#8a8a96; margin-bottom:8px;">Verification code</div>
            <div style="font-size:34px; letter-spacing:0.6em; font-weight:800; color:#fff;">${code}</div>
          </div>
          <p style="margin:0 0 8px; color:#8a8a96; font-size:13px;">This code expires in 10 minutes.</p>
          <p style="margin:24px 0 0; color:#54545e; font-size:12px;">— The Sonik team</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Sonik" <${fromAddress}>`,
        to,
        subject,
        text,
        html,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send OTP email to ${to}: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
