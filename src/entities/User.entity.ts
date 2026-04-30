import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Playlist } from './Playlist.entity';

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

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  googleId!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  resetPasswordTokenHash!: string | null;

  @Column({ type: 'datetime', nullable: true })
  resetPasswordExpiresAt!: Date | null;

  @OneToMany(() => Playlist, (playlist) => playlist.user)
  playlists!: Playlist[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
