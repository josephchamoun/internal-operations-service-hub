import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReassignRequestDto {
  @IsString()
  @IsNotEmpty()
  newTeamId!: string;

  @IsString()
  @IsOptional()
  categoryId?: string;
}