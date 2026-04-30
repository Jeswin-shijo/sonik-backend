import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
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

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getCurrentUser(@Req() request: AuthenticatedRequest) {
    return this.authService.getCurrentUser(request.user.sub);
  }
}
