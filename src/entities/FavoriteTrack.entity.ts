import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Track } from './Track.entity';
import { User } from './User.entity';

@Entity({ name: 'favorite_tracks' })
@Unique(['user', 'track'])
export class FavoriteTrack {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (user) => user.favoriteTracks, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Track, (track) => track.favorites, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'trackId' })
  track!: Track;

  @CreateDateColumn()
  createdAt!: Date;
}
