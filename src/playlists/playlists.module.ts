import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Playlist } from '../entities/Playlist.entity';
import { PlaylistTrack } from '../entities/PlaylistTrack.entity';
import { Track } from '../entities/Track.entity';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Playlist, PlaylistTrack, Track]),
  ],
  controllers: [PlaylistsController],
  providers: [PlaylistsService],
})
export class PlaylistsModule {}
