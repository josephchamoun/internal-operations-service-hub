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
   * triggered it (architecture.md: "notification dispatcher fails... the
   * request stays saved as normal; the notification is queued and retried").
   * For this project's scope, "retried" is simplified to "logged and
   * swallowed" rather than an actual retry queue.
   */
  private async send(to: string, subject: string, body: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to,
        subject,
        text: body,
      });
    } catch (err) {
      this.logger.error(`Failed to send notification to ${to}: ${err}`);
    }
  }

  async notifyUser(userId: string, subject: string, body: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    await this.send(user.email, subject, body);
  }

  async notifyTeam(teamId: string, subject: string, body: string): Promise<void> {
    const memberships = await this.teamMembershipsService.findByTeamId(teamId);

    for (const m of memberships) {
        const user = await this.usersService.findOne(m.userId);
        await this.send(user.email, subject, body);
        await this.delay(300); // stay under the sandbox's per-second rate limit
    }
  }

    private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}