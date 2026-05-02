import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Track } from './Track.entity';
import { User } from './User.entity';

@Entity({ name: 'recent_plays' })
export class RecentPlay {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (user) => user.recentPlays, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Track, (track) => track.recentPlays, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'trackId' })
  track!: Track;

  @Column({ type: 'int', default: 0 })
  progressSeconds!: number;

  @Column({ default: false })
  completed!: boolean;

  @CreateDateColumn()
  playedAt!: Date;
}
