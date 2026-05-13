import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Headers,
  NotFoundException,
  Param,
  Query,
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

const mediaMimeTypes = [
  // Audio
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
  'audio/aac',
  'audio/webm',
  // Video (audio will be extracted)
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/mpeg',
  'video/3gpp',
  'video/x-ms-wmv',
  'video/avi',
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
  listTracks(
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tracksService.listTracks(
      offset ? parseInt(offset, 10) : 0,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('artists')
  listArtists() {
    return this.tracksService.listArtists();
  }

  @UseGuards(JwtAuthGuard)
  @Get('artists/following/me')
  listMyFollowedArtists(@Req() request: AuthenticatedRequest) {
    return this.tracksService.listFollowedArtists(request.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('artists/:id/follow')
  followArtist(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tracksService.followArtist(request.user.sub, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('artists/:id/follow')
  unfollowArtist(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tracksService.unfollowArtist(request.user.sub, id);
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

  @Get('languages')
  listLanguages() {
    return this.tracksService.listLanguages();
  }

  @Get('languages/:id')
  getLanguage(@Param('id') id: string) {
    return this.tracksService.getLanguageById(id);
  }

  @Get('search')
  searchTracks(
    @Query('q') q?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    if (!q?.trim()) return Promise.resolve({ tracks: [] });
    return this.tracksService.searchTracks(
      q,
      offset ? parseInt(offset, 10) : 0,
      limit ? parseInt(limit, 10) : 30,
    );
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

  @Get('covers/:filename')
  streamCover(
    @Param('filename') filename: string,
    @Res() response: Response,
  ) {
    return this.tracksService.streamCover(filename, response);
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
          fileSize: 500 * 1024 * 1024,
        },
        fileFilter: (_req, file, callback) => {
          if (file.fieldname === 'audio') {
            if (!mediaMimeTypes.includes(file.mimetype)) {
              return callback(
                new BadRequestException(
                  `Unsupported media type: ${file.mimetype}`,
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
    return this.tracksService.uploadTrack(body, audioFile, files.cover?.[0]);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/:id')
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
          fileSize: 500 * 1024 * 1024,
        },
        fileFilter: (_req, file, callback) => {
          if (file.fieldname === 'audio') {
            if (!mediaMimeTypes.includes(file.mimetype)) {
              return callback(
                new BadRequestException(
                  `Unsupported media type: ${file.mimetype}`,
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
  updateTrack(
    @Param('id') id: string,
    @UploadedFiles()
    files: { audio?: Express.Multer.File[]; cover?: Express.Multer.File[] },
    @Body() body: Partial<UploadTrackDto>,
  ) {
    return this.tracksService.updateTrack(id, body, files.audio?.[0], files.cover?.[0]);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('admin/:id')
  removeTrack(@Param('id') id: string) {
    return this.tracksService.deactivateTrack(id);
  }
}
