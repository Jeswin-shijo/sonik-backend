import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FavoriteTrack } from './FavoriteTrack.entity';
import { FollowedArtist } from './FollowedArtist.entity';
import { Playlist } from './Playlist.entity';
import { QueueItem } from './QueueItem.entity';
import { RecentPlay } from './RecentPlay.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password', type: 'varchar', length: 255, nullable: true })
  passwordHash!: string | null;

  @Column()
  profileName!: string;

  @Column({ type: 'varchar', length: 20, default: 'local' })
  authProvider!: 'local' | 'google' | 'hybrid';

  @Column({ type: 'varchar', length: 20, default: 'user' })
  role!: 'user' | 'admin' | 'guest';

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  googleId!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  resetPasswordTokenHash!: string | null;

  @Column({ type: 'datetime', nullable: true })
  resetPasswordExpiresAt!: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  otpCode!: string | null;

  @Column({ type: 'datetime', nullable: true })
  otpExpiresAt!: Date | null;

  @Column({ type: 'date', nullable: true })
  birthday!: string | null;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  language!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  avatarUrl!: string | null;

  @OneToMany(() => Playlist, (playlist) => playlist.user)
  playlists!: Playlist[];

  @OneToMany(() => FavoriteTrack, (favoriteTrack) => favoriteTrack.user)
  favoriteTracks!: FavoriteTrack[];

  @OneToMany(() => FollowedArtist, (followedArtist) => followedArtist.user)
  followedArtists!: FollowedArtist[];

  @OneToMany(() => RecentPlay, (recentPlay) => recentPlay.user)
  recentPlays!: RecentPlay[];

  @OneToMany(() => QueueItem, (queueItem) => queueItem.user)
  queueItems!: QueueItem[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
