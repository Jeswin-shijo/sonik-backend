import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './User.entity';

@Entity({ name: 'playlists' })
export class Playlist {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column('simple-array')
  tracks!: string[]; // Track IDs

  @Column({ default: false })
  isFavorite!: boolean;

  @Column()
  userId!: number;

  @ManyToOne(() => User, (user) => user.playlists, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
