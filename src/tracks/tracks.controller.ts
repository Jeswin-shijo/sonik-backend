import {
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
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TracksService } from './tracks.service';

@Controller('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Get()
  listTracks() {
    return this.tracksService.listTracks();
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
}
