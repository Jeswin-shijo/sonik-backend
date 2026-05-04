import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Singer } from '../entities/Singer.entity';
import { Artist } from '../entities/Artist.entity';
import { Lyricist } from '../entities/Lyricist.entity';
import { PeopleService } from './people.service';
import { PeopleController } from './people.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Singer, Artist, Lyricist]),
    AuthModule,
  ],
  controllers: [PeopleController],
  providers: [PeopleService],
  exports: [PeopleService],
})
export class PeopleModule {}
