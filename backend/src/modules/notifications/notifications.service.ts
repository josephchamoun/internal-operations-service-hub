import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { UsersService } from '../users/users.service';
import { TeamMembershipsService } from '../team-memberships/team-memberships.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromEmail: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly teamMembershipsService: TeamMembershipsService,
  ) {
    this.fromEmail =
      this.configService.get<string>('NOTIFICATIONS_FROM_EMAIL') ?? 'noreply@ops-hub.local';

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAILTRAP_HOST'),
      port: Number(this.configService.get<string>('MAILTRAP_PORT')),
      secure: false,
      auth: {
        user: this.configService.get<string>('MAILTRAP_USER'),
        pass: this.configService.get<string>('MAILTRAP_PASS'),
      },
      tls: {
        // Some local/corporate networks have TLS-inspecting proxies or
        // outdated root cert stores that break verification against
        // Mailtrap's sandbox cert chain. Safe to relax here since this only
        // ever talks to the sandbox; do not carry this over to a real
        // production SMTP provider.
        rejectUnauthorized: false,
      },
    });
  }

  /**
   * Fire-and-forget: a failed/slow send must never break the action that
   * triggered it (architecture.md). A short in-process retry covers a
   * transient Mailtrap/SMTP blip; after the last attempt we log and stop.
   * There is no durable outbox — that belongs to a later production queue.
   */
  private async send(to: string, subject: string, body: string): Promise<void> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.transporter.sendMail({
          from: this.fromEmail,
          to,
          subject,
          text: body,
        });
        return;
      } catch (err) {
        if (attempt === maxAttempts) {
          this.logger.error(
            `Failed to send notification to ${to} after ${maxAttempts} attempts: ${err}`,
          );
          return;
        }
        this.logger.warn(
          `Notification to ${to} failed (attempt ${attempt}/${maxAttempts}); retrying`,
        );
        await this.delay(400 * attempt);
      }
    }
  }

  async notifyUser(userId: string, subject: string, body: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
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
  ): Promise<void> {
    const skip = new Set(exceptUserIds);
    const memberships = await this.teamMembershipsService.findByTeamId(teamId);

    for (const m of memberships) {
      if (skip.has(m.userId)) continue;
      const user = await this.usersService.findOne(m.userId);
      await this.send(user.email, subject, body);
      await this.delay(300); // stay under the sandbox's per-second rate limit
    }
  }

    private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}