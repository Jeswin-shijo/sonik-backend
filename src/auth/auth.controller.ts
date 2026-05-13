import { Body, Controller, Delete, Get, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyOtpSignupDto } from './dto/verify-otp-signup.dto';
import { VerifyOtpResetPasswordDto } from './dto/verify-otp-reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { Request } from 'express';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('guest')
  guestLogin() {
    return this.authService.guestLogin();
  }

  @Post('google')
  authenticateWithGoogle(@Body() googleAuthDto: GoogleAuthDto) {
    return this.authService.authenticateWithGoogle(googleAuthDto);
  }

  @Post('forgot-password')
  forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Req() request: Request,
  ) {
    return this.authService.forgotPassword(
      forgotPasswordDto,
      request.hostname ?? 'localhost',
    );
  }

  @Post('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('send-otp')
  sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto);
  }

  @Post('verify-otp-signup')
  verifyOtpSignup(@Body() verifyOtpSignupDto: VerifyOtpSignupDto) {
    return this.authService.verifyOtpSignup(verifyOtpSignupDto);
  }

  @Post('verify-otp-reset-password')
  verifyOtpResetPassword(@Body() verifyOtpResetPasswordDto: VerifyOtpResetPasswordDto) {
    return this.authService.verifyOtpResetPassword(verifyOtpResetPasswordDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('account')
  deleteAccount(@Req() request: AuthenticatedRequest) {
    return this.authService.deleteAccount(request.user.sub);
  }

  @Get('check-email')
  checkEmail(@Query('email') email: string) {
    return this.authService.checkEmailAvailability(email);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getCurrentUser(@Req() request: AuthenticatedRequest) {
    return this.authService.getCurrentUser(request.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(request.user.sub, updateProfileDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(request.user.sub, changePasswordDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: './uploads/avatars',
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp)$/)) {
          cb(new Error('Only image files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadAvatar(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.authService.uploadAvatar(request.user.sub, file.filename);
  }
}

