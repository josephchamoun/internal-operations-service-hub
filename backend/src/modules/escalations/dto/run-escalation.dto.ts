import { IsISO8601, IsOptional } from 'class-validator';

export class RunEscalationDto {
  // TEST-ONLY — ignored in production because this endpoint is gated off.
  @IsOptional()
  @IsISO8601()
  now?: string;
}
