import { IsOptional, IsString, MinLength } from 'class-validator';

export class GoogleAuthDto {
  @IsString()
  @MinLength(10)
  idToken!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  profileName?: string;
}
