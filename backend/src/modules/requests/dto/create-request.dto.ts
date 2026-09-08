import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRequestDto {
  @IsString()
  @IsNotEmpty()
  requesterId!: string;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsString()
  @IsOptional()
  priorityId?: string; 

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsOptional()
  teamId?: string;
}