import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  profileName?: string;

  @IsOptional()
  @IsString()
  birthday?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;
}
