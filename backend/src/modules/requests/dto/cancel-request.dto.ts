import { IsNotEmpty, IsString } from 'class-validator';

export class CancelRequestDto {
  @IsString()
  @IsNotEmpty()
  actorId!: string;
}