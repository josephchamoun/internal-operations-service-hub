import { IsNotEmpty, IsString } from 'class-validator';

export class UpdatePriorityDto {
  @IsString()
  @IsNotEmpty()
  actorId!: string;

  @IsString()
  @IsNotEmpty()
  priorityId!: string;
}