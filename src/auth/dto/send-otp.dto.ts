import { IsEmail, IsIn } from 'class-validator';

export type OtpPurpose = 'signup' | 'reset';

export class SendOtpDto {
  @IsEmail()
  email!: string;

  @IsIn(['signup', 'reset'])
  purpose!: OtpPurpose;
}
