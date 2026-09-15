import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateRequestDetailsDto {
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;
}
