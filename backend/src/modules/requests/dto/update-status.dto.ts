import { IsIn } from 'class-validator';
import { RequestStatus } from '../enums/request-status.enum';

export class UpdateStatusDto {
  @IsIn([RequestStatus.IN_PROGRESS, RequestStatus.RESOLVED])
  status!: RequestStatus.IN_PROGRESS | RequestStatus.RESOLVED;
}
