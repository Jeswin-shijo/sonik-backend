import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { FavoriteTrack } from './entities/FavoriteTrack.entity';
import { FollowedArtist } from './entities/FollowedArtist.entity';
import { Playlist } from './entities/Playlist.entity';
import { PlaylistTrack } from './entities/PlaylistTrack.entity';
import { QueueItem } from './entities/QueueItem.entity';
import { RecentPlay } from './entities/RecentPlay.entity';
import { Track } from './entities/Track.entity';
import { User } from './entities/User.entity';
import { Singer } from './entities/Singer.entity';
import { Artist } from './entities/Artist.entity';
import { Lyricist } from './entities/Lyricist.entity';
import { PlaylistsModule } from './playlists/playlists.module';
import { RealtimeModule } from './realtime/realtime.module';
import { TracksModule } from './tracks/tracks.module';
import { PeopleModule } from './people/people.module';
import { StorageModule } from './storage/storage.module';

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
          entities: [
            User,
            Track,
            Playlist,
            PlaylistTrack,
            FavoriteTrack,
            FollowedArtist,
            RecentPlay,
            QueueItem,
            Singer,
            Artist,
            Lyricist,
          ],
          synchronize:
            configService.get<string>('DB_SYNCHRONIZE', 'true') === 'true',
          logging: configService.get<string>('DB_LOGGING', 'false') === 'true',
        }),
      }),
    ];

const featureModules = isTestEnvironment
  ? []
  : [StorageModule, AuthModule, TracksModule, PlaylistsModule, PeopleModule, RealtimeModule];

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
