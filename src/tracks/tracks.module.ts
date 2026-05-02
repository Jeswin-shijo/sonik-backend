import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FavoriteTrack } from '../entities/FavoriteTrack.entity';
import { RecentPlay } from '../entities/RecentPlay.entity';
import { Track } from '../entities/Track.entity';
import { TracksController } from './tracks.controller';
import { TracksService } from './tracks.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Track, FavoriteTrack, RecentPlay]),
  ],
  controllers: [TracksController],
  providers: [TracksService],
})
export class TracksModule {}
