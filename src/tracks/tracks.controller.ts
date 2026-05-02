import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadTrackDto } from './dto/upload-track.dto';
import { TracksService } from './tracks.service';

const audioMimeTypes = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/flac',
  'audio/x-flac',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
];

const imageMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

function uniqueFileName(originalName: string) {
  const stamp = Date.now();
  const random = randomBytes(6).toString('hex');
  return `${stamp}-${random}${extname(originalName).toLowerCase()}`;
}

@Controller('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Get()
  listTracks() {
    return this.tracksService.listTracks();
  }

  @Get('artists')
  listArtists() {
    return this.tracksService.listArtists();
  }

  @Get('artists/:id')
  getArtist(@Param('id') id: string) {
    return this.tracksService.getArtistById(id);
  }

  @Get('albums')
  listAlbums() {
    return this.tracksService.listAlbums();
  }

  @Get('albums/:id')
  getAlbum(@Param('id') id: string) {
    return this.tracksService.getAlbumById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('favorites/me')
  listMyFavorites(@Req() request: AuthenticatedRequest) {
    return this.tracksService.listFavorites(request.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('recent/me')
  listMyRecentPlays(@Req() request: AuthenticatedRequest) {
    return this.tracksService.listRecentPlays(request.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('queue/me')
  listMyQueue(@Req() request: AuthenticatedRequest) {
    return this.tracksService.listQueue(request.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/queue')
  addTrackToQueue(
    @Param('id') id: string,
    @Body()
    body: {
      mode?: 'next' | 'end';
    },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tracksService.addToQueue(
      request.user.sub,
      id,
      body.mode === 'next' ? 'next' : 'end',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/play-next')
  playTrackNext(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tracksService.addToQueue(request.user.sub, id, 'next');
  }

  @UseGuards(JwtAuthGuard)
  @Delete('queue/me')
  clearQueue(@Req() request: AuthenticatedRequest) {
    return this.tracksService.clearQueue(request.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('queue/:queueItemId')
  removeQueueItem(
    @Param('queueItemId') queueItemId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tracksService.removeQueueItem(request.user.sub, queueItemId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/favorite')
  favoriteTrack(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tracksService.favoriteTrack(request.user.sub, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/favorite')
  unfavoriteTrack(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tracksService.unfavoriteTrack(request.user.sub, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/recent')
  recordRecentPlay(
    @Param('id') id: string,
    @Body()
    body: {
      progressSeconds?: number;
      completed?: boolean;
    },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tracksService.recordRecentPlay(request.user.sub, id, body);
  }

  @Get(':id/stream')
  async streamTrack(
    @Param('id') id: string,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ) {
    const track = await this.tracksService.getTrackById(id);

    if (!track) {
      throw new NotFoundException('Track not found.');
    }

    return this.tracksService.streamTrack(track, range, response);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/upload')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'audio', maxCount: 1 },
        { name: 'cover', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (_req, file, callback) => {
            const subdir = file.fieldname === 'cover' ? 'covers' : 'tracks';
            callback(null, join(process.cwd(), 'uploads', subdir));
          },
          filename: (_req, file, callback) => {
            callback(null, uniqueFileName(file.originalname));
          },
        }),
        limits: {
          fileSize: 50 * 1024 * 1024,
        },
        fileFilter: (_req, file, callback) => {
          if (file.fieldname === 'audio') {
            if (!audioMimeTypes.includes(file.mimetype)) {
              return callback(
                new BadRequestException(
                  `Unsupported audio type: ${file.mimetype}`,
                ),
                false,
              );
            }
          } else if (file.fieldname === 'cover') {
            if (!imageMimeTypes.includes(file.mimetype)) {
              return callback(
                new BadRequestException(
                  `Unsupported cover image type: ${file.mimetype}`,
                ),
                false,
              );
            }
          }
          callback(null, true);
        },
      },
    ),
  )
  uploadTrack(
    @UploadedFiles()
    files: { audio?: Express.Multer.File[]; cover?: Express.Multer.File[] },
    @Body() body: UploadTrackDto,
  ) {
    const audioFile = files.audio?.[0];
    if (!audioFile) {
      throw new BadRequestException('Audio file is required.');
    }
    return this.tracksService.uploadTrack(body, audioFile, files.cover?.[0]);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('admin/:id')
  removeTrack(@Param('id') id: string) {
    return this.tracksService.deactivateTrack(id);
  }
}
