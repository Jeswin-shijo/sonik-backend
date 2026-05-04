import { Body, Controller, Delete, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendOtpDto } from './dto/send-otp.dto';
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
}
