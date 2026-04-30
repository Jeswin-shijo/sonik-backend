import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { Playlist } from './entities/Playlist.entity';
import { User } from './entities/User.entity';

const isTestEnvironment = process.env.NODE_ENV === 'test';

const databaseImports = isTestEnvironment
  ? []
  : [
      TypeOrmModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          type: 'mysql' as const,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: Number(configService.get<string>('DB_PORT', '3306')),
          username: configService.get<string>('DB_USERNAME', 'sonik_user'),
          password: configService.get<string>('DB_PASSWORD', 'sonikpass'),
          database: configService.get<string>('DB_DATABASE', 'sonik_db'),
          entities: [User, Playlist],
          synchronize:
            configService.get<string>('DB_SYNCHRONIZE', 'true') === 'true',
          logging: configService.get<string>('DB_LOGGING', 'false') === 'true',
        }),
      }),
    ];

const featureModules = isTestEnvironment ? [] : [AuthModule];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ...databaseImports,
    ...featureModules,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
