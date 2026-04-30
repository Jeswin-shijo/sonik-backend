import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getOverview() {
    return {
      ...this.buildHealthPayload(),
      name: 'Sonik API',
      platform: 'web-and-mobile-music',
      endpoints: {
        auth: '/auth',
        health: '/health',
      },
    };
  }

  getHealth() {
    return this.buildHealthPayload();
  }

  private buildHealthPayload() {
    return {
      service: 'sonik-backend',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
