import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve4 } from 'dns/promises';
import * as nodemailer from 'nodemailer';
import { UsersService } from '../users/users.service';
import { TeamMembershipsService } from '../team-memberships/team-memberships.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter | undefined;
  private readonly fromEmail: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly teamMembershipsService: TeamMembershipsService,
  ) {
    this.fromEmail =
      this.configService.get<string>('NOTIFICATIONS_FROM_EMAIL') ?? 'noreply@ops-hub.local';
  }

  /**
   * Nodemailer picks a Gmail address at random, and that pick is often IPv6.
   * Render cannot open those addresses (ENETUNREACH). Connect to an IPv4
   * address and keep the hostname for the TLS name check.
   */
  private async getTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) return this.transporter;
    const hostname = this.configService.get<string>('MAILTRAP_HOST') ?? '';
    const addresses = await resolve4(hostname);
    const ipv4 = addresses[0];
    if (!ipv4) {
      throw new Error(`No IPv4 address for ${hostname}`);
    }
    const transport = {
      host: ipv4,
      port: Number(this.configService.get<string>('MAILTRAP_PORT')),
      secure: false,
      servername: hostname,
      auth: {
        user: this.configService.get<string>('MAILTRAP_USER'),
        pass: (this.configService.get<string>('MAILTRAP_PASS') ?? '').replace(/\s+/g, ''),
      },
      tls: {
        servername: hostname,
        // Some local/corporate networks have TLS-inspecting proxies or
        // outdated root cert stores that break verification against
        // Mailtrap's sandbox cert chain. Safe to relax here since this only
        // ever talks to the sandbox; do not carry this over to a real
        // production SMTP provider.
        rejectUnauthorized: false,
      },
    };
    this.logger.log(`Mail host ${hostname} will be reached at IPv4 ${ipv4}`);
    this.transporter = nodemailer.createTransport(transport);
    return this.transporter;
  }

  /**
   * Fire-and-forget: a failed/slow send must never break the action that
   * triggered it (architecture.md). A short in-process retry covers a
   * transient Mailtrap/SMTP blip; after the last attempt we log and stop.
   * There is no durable outbox — that belongs to a later production queue.
   */
  private async send(to: string, subject: string, body: string): Promise<boolean> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const transporter = await this.getTransporter();
        await transporter.sendMail({
          from: this.fromEmail,
          to,
          subject,
          text: body,
        });
        return true;
      } catch (err) {
        if (attempt === maxAttempts) {
          this.logger.error(
            `Failed to send notification to ${to} after ${maxAttempts} attempts: ${err}`,
          );
          return false;
        }
        this.logger.warn(
          `Notification to ${to} failed (attempt ${attempt}/${maxAttempts}); retrying`,
        );
        await this.delay(400 * attempt);
      }
    }
    return false;
  }

  async notifyUser(userId: string, subject: string, body: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (!user.active) return;
    await this.send(user.email, subject, body);
  }

  async notifyTeam(teamId: string, subject: string, body: string): Promise<void> {
    await this.notifyTeamExcept(teamId, [], subject, body);
  }

  async notifyTeamExcept(
    teamId: string,
    exceptUserIds: string[],
    subject: string,
    body: string,
  ): Promise<{ recipients: number; sent: number }> {
    const skip = new Set(exceptUserIds);
    const memberships = await this.teamMembershipsService.findByTeamId(teamId);
    let recipients = 0;
    let sent = 0;

    for (const m of memberships) {
      if (skip.has(m.userId)) continue;
      const user = await this.usersService.findOne(m.userId);
      if (!user.active) continue;
      recipients += 1;
      const ok = await this.send(user.email, subject, body);
      if (ok) sent += 1;
      await this.delay(300); // stay under the sandbox's per-second rate limit
    }

    return { recipients, sent };
  }

    private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}