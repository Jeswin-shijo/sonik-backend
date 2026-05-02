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

@Entity({ name: 'queue_items' })
export class QueueItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (user) => user.queueItems, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Track, (track) => track.queueItems, {
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
