import { IsEmail, IsString, MinLength } from 'class-validator';

export class VerifyOtpSignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  otp!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  profileName!: string;
}
