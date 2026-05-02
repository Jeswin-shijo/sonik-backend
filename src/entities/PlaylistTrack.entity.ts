import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Playlist } from './Playlist.entity';
import { Track } from './Track.entity';

@Entity({ name: 'playlist_tracks' })
@Unique(['playlist', 'track'])
export class PlaylistTrack {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Playlist, (playlist) => playlist.playlistTracks, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'playlistId' })
  playlist!: Playlist;

  @ManyToOne(() => Track, (track) => track.playlistTracks, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'trackId' })
  track!: Track;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
