import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Playlist } from '../entities/Playlist.entity';
import { PlaylistTrack } from '../entities/PlaylistTrack.entity';
import { Track } from '../entities/Track.entity';
import { User } from '../entities/User.entity';

@Injectable()
export class PlaylistsService {
  constructor(
    @InjectRepository(Playlist)
    private readonly playlistsRepository: Repository<Playlist>,
    @InjectRepository(PlaylistTrack)
    private readonly playlistTracksRepository: Repository<PlaylistTrack>,
    @InjectRepository(Track)
    private readonly tracksRepository: Repository<Track>,
  ) {}

  async listPlaylists(userId: number) {
    const playlists = await this.playlistsRepository.find({
      where: { user: { id: userId } },
      relations: {
        playlistTracks: {
          track: true,
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return {
      playlists: playlists.map((playlist) => this.serializePlaylist(playlist)),
    };
  }

  async createPlaylist(
    userId: number,
    body: {
      name?: string;
      description?: string;
    },
  ) {
    const name = body.name?.trim();

    if (!name) {
      throw new BadRequestException('Playlist name is required.');
    }

    const playlist = await this.playlistsRepository.save(
      this.playlistsRepository.create({
        name,
        description: body.description?.trim() || null,
        isFavorite: false,
        user: { id: userId } as User,
      }),
    );

    return {
      playlist: this.serializePlaylist({
        ...playlist,
        playlistTracks: [],
      }),
    };
  }

  async getPlaylist(userId: number, playlistId: string) {
    const playlist = await this.findOwnedPlaylist(userId, playlistId);

    return {
      playlist: this.serializePlaylist(playlist),
    };
  }

  async addTrack(userId: number, playlistId: string, trackId: string) {
    const playlist = await this.findOwnedPlaylist(userId, playlistId);
    const track = await this.tracksRepository.findOne({
      where: {
        id: Number(trackId),
        isActive: true,
      },
    });

    if (!track) {
      throw new NotFoundException('Track not found.');
    }

    const existing = await this.playlistTracksRepository.findOne({
      where: {
        playlist: { id: playlist.id },
        track: { id: track.id },
      },
    });

    if (!existing) {
      await this.playlistTracksRepository.save(
        this.playlistTracksRepository.create({
          playlist,
          track,
          position: playlist.playlistTracks.length,
        }),
      );
    }

    return this.getPlaylist(userId, playlistId);
  }

  async removeTrack(userId: number, playlistId: string, trackId: string) {
    const playlist = await this.findOwnedPlaylist(userId, playlistId);

    await this.playlistTracksRepository
      .createQueryBuilder()
      .delete()
      .where('playlistId = :playlistId', { playlistId: playlist.id })
      .andWhere('trackId = :trackId', { trackId: Number(trackId) })
      .execute();

    return this.getPlaylist(userId, playlistId);
  }

  async deletePlaylist(userId: number, playlistId: string) {
    const playlist = await this.findOwnedPlaylist(userId, playlistId);
    await this.playlistsRepository.delete(playlist.id);

    return {
      message: 'Playlist deleted.',
    };
  }

  private async findOwnedPlaylist(userId: number, playlistId: string) {
    const playlist = await this.playlistsRepository.findOne({
      where: {
        id: Number(playlistId),
        user: { id: userId },
      },
      relations: {
        playlistTracks: {
          track: true,
        },
      },
      order: {
        playlistTracks: {
          position: 'ASC',
        },
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found.');
    }

    return playlist;
  }

  private serializePlaylist(playlist: Playlist) {
    const playlistTracks = [...(playlist.playlistTracks ?? [])].sort(
      (first, second) => first.position - second.position,
    );

    return {
      id: String(playlist.id),
      name: playlist.name,
      description: playlist.description,
      trackCount: playlistTracks.length,
      tracks: playlistTracks.map((playlistTrack, index) => ({
        id: String(playlistTrack.track.id),
        title: playlistTrack.track.title,
        artist: playlistTrack.track.artist,
        album: playlistTrack.track.album,
        duration: playlistTrack.track.duration ?? '--:--',
        plays: playlistTrack.track.playCount
          ? `${playlistTrack.track.playCount}`
          : 'Local',
        mood: playlistTrack.track.mood,
        coverClass: [
          'cover-neon',
          'cover-coast',
          'cover-velvet',
          'cover-summer',
          'cover-blue',
        ][index % 5],
        streamUrl: playlistTrack.track.streamUrl ?? `/tracks/${playlistTrack.track.id}/stream`,
      })),
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
    };
  }
}
