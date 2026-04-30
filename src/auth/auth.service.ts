import {
  BadRequestException,
  ConflictException,
  Injectable,
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

type AuthProvider = 'local' | 'google' | 'hybrid';

type AuthTokenPayload = {
  sub: number;
  email: string;
  profileName: string;
  authProvider: AuthProvider;
};

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
      googleId: null,
      resetPasswordTokenHash: null,
      resetPasswordExpiresAt: null,
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
        googleId: payload.sub,
        resetPasswordTokenHash: null,
        resetPasswordExpiresAt: null,
      });
    } else {
      user.googleId = payload.sub;
      user.profileName = user.profileName || profileName;
      user.authProvider = user.passwordHash ? 'hybrid' : 'google';
    }

    const savedUser = await this.usersRepository.save(user);

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

  async getCurrentUser(userId: number) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User session is no longer valid.');
    }

    return {
      user: this.serializeUser(user),
    };
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
      googleConnected: Boolean(user.googleId),
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
}
