import { IsNotEmpty, IsString } from 'class-validator';

export class UpdatePriorityDto {
  @IsString()
  @IsNotEmpty()
  priorityId!: string;
}