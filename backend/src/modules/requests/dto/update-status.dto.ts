import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { RequestStatus } from '../enums/request-status.enum';

export class UpdateStatusDto {
  @IsString()
  @IsNotEmpty()
  actorId!: string;

  // Only the claimant-driven transitions live here.
  // Cancelled is a separate, requester-only action — see CancelRequestDto.
  @IsIn([RequestStatus.IN_PROGRESS, RequestStatus.RESOLVED])
  status!: RequestStatus;
}