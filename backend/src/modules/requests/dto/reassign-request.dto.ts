import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReassignRequestDto {
  @IsString()
  @IsNotEmpty()
  actorId!: string;

  @IsString()
  @IsNotEmpty()
  newTeamId!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}