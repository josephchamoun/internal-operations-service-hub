import { IsArray, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

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

  @ValidateIf((dto: CreateUserDto) => typeof dto.password === 'string' && dto.password.length > 0)
  @IsString()
  @MinLength(8)
  password?: string;
}
