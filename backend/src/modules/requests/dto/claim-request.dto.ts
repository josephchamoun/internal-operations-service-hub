import { IsNotEmpty, IsString } from 'class-validator';

export class ClaimRequestDto {
  @IsString()
  @IsNotEmpty()
  actorId!: string;
}