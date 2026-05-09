import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FavoriteTrack } from '../entities/FavoriteTrack.entity';
import { QueueItem } from '../entities/QueueItem.entity';
import { RecentPlay } from '../entities/RecentPlay.entity';
import { Track } from '../entities/Track.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { TracksController } from './tracks.controller';
import { TracksService } from './tracks.service';

@Module({
  imports: [
    AuthModule,
    RealtimeModule,
    TypeOrmModule.forFeature([Track, FavoriteTrack, RecentPlay, QueueItem]),
  ],
  controllers: [TracksController],
  providers: [TracksService],
})
export class TracksModule {}
