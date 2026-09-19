import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreatePriorityDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(1)
  escalationWindowMinutes!: number;
}
