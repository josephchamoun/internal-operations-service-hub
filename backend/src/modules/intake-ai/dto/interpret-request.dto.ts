import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class InterpretRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  draft!: string;
}
