import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const token = authorizationHeader.slice(7);

    try {
      request.user = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>(
          'JWT_SECRET',
          'change-me-in-production',
        ),
      });

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }
}
