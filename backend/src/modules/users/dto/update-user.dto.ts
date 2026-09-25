import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(['employee', 'team_member', 'admin'])
  role?: 'employee' | 'team_member' | 'admin';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teamIds?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
