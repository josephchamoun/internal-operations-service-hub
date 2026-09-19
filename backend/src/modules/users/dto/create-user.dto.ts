import { IsArray, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsEnum(['employee', 'team_member', 'admin'])
  role?: 'employee' | 'team_member' | 'admin';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teamIds?: string[];
}
