import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Track } from './Track.entity';

@Entity({ name: 'singers' })
export class Singer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageName!: string | null;

  @OneToMany(() => Track, (track) => track.singer)
  tracks!: Track[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
