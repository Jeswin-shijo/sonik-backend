import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { compare, hash } from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { createHash, randomBytes } from 'crypto';
import { User } from '../entities/User.entity';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpSignupDto } from './dto/verify-otp-signup.dto';
import { VerifyOtpResetPasswordDto } from './dto/verify-otp-reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { EmailService } from './email.service';

type AuthProvider = 'local' | 'google' | 'hybrid';
type UserRole = 'user' | 'admin' | 'guest';

type AuthTokenPayload = {
  sub: number;
  email: string;
  profileName: string;
  authProvider: AuthProvider;
  role: UserRole;
};

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const email = registerDto.email.trim().toLowerCase();
    const existingUser = await this.usersRepository.findOne({ where: { email } });

    if (existingUser) {
      throw new ConflictException('An account with that email already exists.');
    }

    const user = this.usersRepository.create({
      email,
      profileName: registerDto.profileName.trim(),
      passwordHash: await this.hashPassword(registerDto.password),
      authProvider: 'local',
      role: this.resolveRole(email),
      googleId: null,
      resetPasswordTokenHash: null,
      resetPasswordExpiresAt: null,
      otpCode: null,
      otpExpiresAt: null,
    });

    const savedUser = await this.usersRepository.save(user);

    return this.buildAuthResponse(savedUser, 'Account created successfully.');
  }

  async login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase();
    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user?.passwordHash) {
      throw new UnauthorizedException(
        'Invalid credentials or use Google sign-in for this account.',
      );
    }

    const isPasswordValid = await compare(loginDto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const expectedRole = this.resolveRole(user.email);
    if (user.role !== expectedRole) {
      user.role = expectedRole;
      await this.usersRepository.save(user);
    }

    void this.emailService.sendLoginNotificationEmail(user.email, user.profileName);

    return this.buildAuthResponse(user, 'Signed in successfully.');
  }

  async authenticateWithGoogle(googleAuthDto: GoogleAuthDto) {
    const audience = this.getGoogleAudience();

    if (!audience.length) {
      throw new BadRequestException(
        'Google sign-in is not configured on the server yet.',
      );
    }

    const ticket = await this.googleClient.verifyIdToken({
      idToken: googleAuthDto.idToken,
      audience,
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Unable to verify the Google account.');
    }

    const email = payload.email.trim().toLowerCase();
    const profileName =
      googleAuthDto.profileName?.trim() ||
      payload.name?.trim() ||
      email.split('@')[0] ||
      'Sonik Listener';

    let user =
      (await this.usersRepository.findOne({
        where: { googleId: payload.sub },
      })) ??
      (await this.usersRepository.findOne({
        where: { email },
      }));

    if (!user) {
      user = this.usersRepository.create({
        email,
        profileName,
        passwordHash: null,
        authProvider: 'google',
        role: this.resolveRole(email),
        googleId: payload.sub,
        resetPasswordTokenHash: null,
        resetPasswordExpiresAt: null,
        otpCode: null,
        otpExpiresAt: null,
        avatarUrl: payload.picture || null,
      });
    } else {
      user.googleId = payload.sub;
      user.profileName = user.profileName || profileName;
      user.authProvider = user.passwordHash ? 'hybrid' : 'google';
      user.role = this.resolveRole(user.email);
      if (!user.avatarUrl && payload.picture) {
        user.avatarUrl = payload.picture;
      }
    }

    const isNewUser = !user.id;
    const savedUser = await this.usersRepository.save(user);

    if (isNewUser) {
      void this.emailService.sendWelcomeEmail(savedUser.email, savedUser.profileName);
    } else {
      void this.emailService.sendLoginNotificationEmail(savedUser.email, savedUser.profileName);
    }

    return this.buildAuthResponse(savedUser, 'Google account connected.');
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto, hostname: string) {
    const email = forgotPasswordDto.email.trim().toLowerCase();
    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user) {
      return {
        message:
          'If an account with that email exists, a reset instruction has been prepared.',
      };
    }

    const resetToken = randomBytes(32).toString('hex');
    const resetPasswordTokenHash = this.hashResetToken(resetToken);
    const resetPasswordExpiresAt = new Date(
      Date.now() + this.getResetTokenTtlMinutes() * 60_000,
    );

    user.resetPasswordTokenHash = resetPasswordTokenHash;
    user.resetPasswordExpiresAt = resetPasswordExpiresAt;
    await this.usersRepository.save(user);

    const response: {
      message: string;
      devResetToken?: string;
      expiresAt?: string;
      host?: string;
    } = {
      message:
        'If an account with that email exists, a reset instruction has been prepared.',
    };

    if (this.shouldExposeResetToken()) {
      response.devResetToken = resetToken;
      response.expiresAt = resetPasswordExpiresAt.toISOString();
      response.host = hostname;
    }

    return response;
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const resetPasswordTokenHash = this.hashResetToken(
      resetPasswordDto.token.trim(),
    );

    const user = await this.usersRepository.findOne({
      where: { resetPasswordTokenHash },
    });

    if (
      !user ||
      !user.resetPasswordExpiresAt ||
      user.resetPasswordExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Reset token is invalid or has expired.');
    }

    user.passwordHash = await this.hashPassword(resetPasswordDto.newPassword);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    user.authProvider = user.googleId ? 'hybrid' : 'local';

    const savedUser = await this.usersRepository.save(user);

    return this.buildAuthResponse(savedUser, 'Password updated successfully.');
  }

  async sendOtp(sendOtpDto: SendOtpDto) {
    const email = sendOtpDto.email.trim().toLowerCase();
    const purpose = sendOtpDto.purpose;
    const user = await this.usersRepository.findOne({ where: { email } });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const otpHash = await this.hashPassword(otpCode);

    if (purpose === 'signup') {
      if (user?.passwordHash) {
        throw new ConflictException(
          'An account with that email already exists. Please sign in instead.',
        );
      }

      if (user) {
        user.otpCode = otpHash;
        user.otpExpiresAt = otpExpiresAt;
        await this.usersRepository.save(user);
      } else {
        const tempUser = this.usersRepository.create({
          email,
          profileName: '',
          passwordHash: null,
          authProvider: 'local',
          googleId: null,
          resetPasswordTokenHash: null,
          resetPasswordExpiresAt: null,
          otpCode: otpHash,
          otpExpiresAt,
        });
        await this.usersRepository.save(tempUser);
      }
    } else {
      if (!user) {
        return {
          message:
            'If an account with that email exists, a verification code has been sent.',
          expiresAt: otpExpiresAt.toISOString(),
        };
      }

      user.otpCode = otpHash;
      user.otpExpiresAt = otpExpiresAt;
      await this.usersRepository.save(user);
    }

    const emailSent = await this.emailService.sendOtpEmail(
      email,
      otpCode,
      purpose,
    );

    return {
      message: emailSent
        ? 'Verification code sent to your email.'
        : 'OTP generated. Email delivery is not configured yet.',
      devOtp: !emailSent && this.shouldExposeOtp() ? otpCode : undefined,
      expiresAt: otpExpiresAt.toISOString(),
    };
  }

  async verifyOtpSignup(verifyOtpSignupDto: VerifyOtpSignupDto) {
    const email = verifyOtpSignupDto.email.trim().toLowerCase();
    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException('No account found with this email.');
    }

    if (!user.otpCode || !user.otpExpiresAt) {
      throw new BadRequestException('No OTP request found. Please request a new OTP.');
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('OTP has expired. Please request a new OTP.');
    }

    const isOtpValid = await compare(verifyOtpSignupDto.otp, user.otpCode);

    if (!isOtpValid) {
      throw new UnauthorizedException('Invalid OTP. Please check and try again.');
    }

    user.profileName = verifyOtpSignupDto.profileName.trim();
    user.passwordHash = await this.hashPassword(verifyOtpSignupDto.password);
    user.otpCode = null;
    user.otpExpiresAt = null;
    user.authProvider = 'local';
    user.role = this.resolveRole(user.email);

    const savedUser = await this.usersRepository.save(user);

    void this.emailService.sendWelcomeEmail(savedUser.email, savedUser.profileName);

    return this.buildAuthResponse(savedUser, 'Account created successfully.');
  }

  async verifyOtpResetPassword(verifyOtpResetPasswordDto: VerifyOtpResetPasswordDto) {
    const email = verifyOtpResetPasswordDto.email.trim().toLowerCase();
    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException('No account found with this email.');
    }

    if (!user.otpCode || !user.otpExpiresAt) {
      throw new BadRequestException('No OTP request found. Please request a new OTP.');
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('OTP has expired. Please request a new OTP.');
    }

    const isOtpValid = await compare(verifyOtpResetPasswordDto.otp, user.otpCode);

    if (!isOtpValid) {
      throw new UnauthorizedException('Invalid OTP. Please check and try again.');
    }

    // Update password
    user.passwordHash = await this.hashPassword(verifyOtpResetPasswordDto.newPassword);
    user.otpCode = null;
    user.otpExpiresAt = null;
    user.authProvider = user.googleId ? 'hybrid' : 'local';

    const savedUser = await this.usersRepository.save(user);

    void this.emailService.sendPasswordResetSuccessEmail(savedUser.email, savedUser.profileName);

    return this.buildAuthResponse(savedUser, 'Password updated successfully.');
  }

  async deleteAccount(userId: number) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User account not found.');
    }

    const { email, profileName } = user;

    await this.usersRepository.delete(userId);

    void this.emailService.sendAccountDeletedEmail(email, profileName);

    return {
      message: 'Account and all related data have been deleted successfully.',
    };
  }

  async getCurrentUser(userId: number) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User session is no longer valid.');
    }

    return {
      user: this.serializeUser(user),
    };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User account not found.');
    }

    if (dto.profileName !== undefined) {
      user.profileName = dto.profileName.trim();
    }
    if (dto.birthday !== undefined) {
      user.birthday = dto.birthday;
    }
    if (dto.language !== undefined) {
      user.language = dto.language;
    }

    const savedUser = await this.usersRepository.save(user);

    return {
      message: 'Profile updated successfully.',
      user: this.serializeUser(savedUser),
    };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User account not found.');
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account uses Google sign-in. Set a password via forgot password first.',
      );
    }

    const isCurrentValid = await compare(dto.currentPassword, user.passwordHash);

    if (!isCurrentValid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    user.passwordHash = await this.hashPassword(dto.newPassword);
    const savedUser = await this.usersRepository.save(user);

    void this.emailService.sendPasswordChangedEmail(savedUser.email, savedUser.profileName);

    return {
      message: 'Password changed successfully.',
      user: this.serializeUser(savedUser),
    };
  }

  async uploadAvatar(userId: number, filename: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User account not found.');
    }

    user.avatarUrl = filename;
    const savedUser = await this.usersRepository.save(user);

    return {
      message: 'Avatar updated successfully.',
      user: this.serializeUser(savedUser),
    };
  }

  async checkEmailAvailability(email: string) {
    if (!email?.trim()) {
      return { available: true };
    }
    const normalized = email.trim().toLowerCase();
    const user = await this.usersRepository.findOne({
      where: { email: normalized },
    });
    // Consider email taken only if a user exists with a password (fully registered)
    const taken = Boolean(user?.passwordHash);
    return { available: !taken };
  }

  async guestLogin() {
    // Clean up guest accounts older than 24 hours
    await this.usersRepository
      .createQueryBuilder()
      .delete()
      .where('role = :role', { role: 'guest' })
      .andWhere('createdAt < :cutoff', {
        cutoff: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .execute();

    const guestId = randomBytes(8).toString('hex');
    const user = this.usersRepository.create({
      email: `guest-${guestId}@sonik.guest`,
      profileName: 'Guest',
      passwordHash: null,
      authProvider: 'local',
      role: 'guest',
      googleId: null,
      resetPasswordTokenHash: null,
      resetPasswordExpiresAt: null,
      otpCode: null,
      otpExpiresAt: null,
    });

    const savedUser = await this.usersRepository.save(user);
    return this.buildAuthResponse(savedUser, 'Signed in as guest.');
  }

  private async buildAuthResponse(user: User, message: string) {
    return {
      message,
      accessToken: await this.signAccessToken(user),
      tokenType: 'Bearer',
      user: this.serializeUser(user),
    };
  }

  private serializeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      profileName: user.profileName,
      authProvider: user.authProvider,
      role: user.role,
      googleConnected: Boolean(user.googleId),
      birthday: user.birthday ?? null,
      language: user.language ?? 'en',
      avatarUrl: user.avatarUrl ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async signAccessToken(user: User) {
    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      profileName: user.profileName,
      authProvider: user.authProvider,
      role: user.role,
    };

    return this.jwtService.signAsync(payload);
  }

  private async hashPassword(password: string) {
    return hash(password, this.getPasswordSaltRounds());
  }

  private getPasswordSaltRounds() {
    return Number(this.configService.get<string>('PASSWORD_SALT_ROUNDS', '12'));
  }

  private getResetTokenTtlMinutes() {
    return Number(
      this.configService.get<string>('RESET_TOKEN_TTL_MINUTES', '15'),
    );
  }

  private shouldExposeResetToken() {
    return (
      this.configService.get<string>('AUTH_EXPOSE_RESET_TOKEN', 'true') ===
      'true'
    );
  }

  private shouldExposeOtp() {
    return this.shouldExposeResetToken();
  }

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private getGoogleAudience() {
    return [
      this.configService.get<string>('GOOGLE_WEB_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_IOS_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_ANDROID_CLIENT_ID'),
    ].filter((clientId): clientId is string => Boolean(clientId?.trim()));
  }

  private resolveRole(email: string): UserRole {
    const adminList = this.configService.get<string>('ADMIN_EMAILS', '');
    const normalized = email.trim().toLowerCase();
    const isAdmin = adminList
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
      .includes(normalized);
    return isAdmin ? 'admin' : 'user';
  }
}
