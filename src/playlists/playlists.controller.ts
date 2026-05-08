import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlaylistsService } from './playlists.service';

@UseGuards(JwtAuthGuard)
@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @Get()
  listPlaylists(@Req() request: AuthenticatedRequest) {
    return this.playlistsService.listPlaylists(request.user.sub);
  }

  @Post()
  createPlaylist(
    @Body()
    body: {
      name?: string;
      description?: string;
    },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.playlistsService.createPlaylist(request.user.sub, body);
  }

  @Get(':id')
  getPlaylist(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.playlistsService.getPlaylist(request.user.sub, id);
  }

  @Patch(':id')
  updatePlaylist(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.playlistsService.updatePlaylist(request.user.sub, id, body);
  }

  @Post(':id/tracks/:trackId')
  addTrack(
    @Param('id') id: string,
    @Param('trackId') trackId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.playlistsService.addTrack(request.user.sub, id, trackId);
  }

  @Delete(':id/tracks/:trackId')
  removeTrack(
    @Param('id') id: string,
    @Param('trackId') trackId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.playlistsService.removeTrack(request.user.sub, id, trackId);
  }

  @Delete(':id')
  deletePlaylist(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.playlistsService.deletePlaylist(request.user.sub, id);
  }
}
