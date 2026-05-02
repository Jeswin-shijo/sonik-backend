import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FavoriteTrack } from './FavoriteTrack.entity';
import { PlaylistTrack } from './PlaylistTrack.entity';
import { RecentPlay } from './RecentPlay.entity';

@Entity({ name: 'tracks' })
export class Track {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  storageKey!: string;

  @Column()
  title!: string;

  @Column({ default: 'Unknown Artist' })
  artist!: string;

  @Column({ default: 'Local Library' })
  album!: string;

  @Column({ type: 'varchar', length: 24, nullable: true })
  duration!: string | null;

  @Column({ type: 'int', nullable: true })
  durationSeconds!: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  genre!: string | null;

  @Column({ default: 'Local' })
  mood!: string;

  @Column({ type: 'varchar', length: 40, default: 'local' })
  source!: 'local' | 'remote';

  @Column({ type: 'varchar', length: 500, nullable: true })
  streamUrl!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverUrl!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  localFileName!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  localFilePath!: string | null;

  @Column({ default: 'audio/mpeg' })
  mimeType!: string;

  @Column({ type: 'bigint', default: 0 })
  sizeBytes!: string;

  @Column({ type: 'int', default: 0 })
  playCount!: number;

  @Column({ default: true })
  isActive!: boolean;

  @OneToMany(() => FavoriteTrack, (favoriteTrack) => favoriteTrack.track)
  favorites!: FavoriteTrack[];

  @OneToMany(() => PlaylistTrack, (playlistTrack) => playlistTrack.track)
  playlistTracks!: PlaylistTrack[];

  @OneToMany(() => RecentPlay, (recentPlay) => recentPlay.track)
  recentPlays!: RecentPlay[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
