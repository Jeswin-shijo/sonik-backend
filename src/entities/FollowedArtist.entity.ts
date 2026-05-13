import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './User.entity';

@Entity({ name: 'followed_artists' })
@Unique(['user', 'artistId'])
export class FollowedArtist {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (user) => user.followedArtists, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  artistId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
