import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UploadTrackDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  artist?: string;

  @IsOptional()
  @IsString()
  singerId?: string;

  @IsOptional()
  @IsString()
  artistId?: string;

  @IsOptional()
  @IsString()
  lyricistId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  album?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  genre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  mood?: string;

  @IsOptional()
  @IsString()
  audioFileName?: string;

  @IsOptional()
  @IsString()
  coverImageName?: string;
}
