import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, existsSync, readdirSync, statSync } from 'fs';
import { extname, join, parse } from 'path';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { FavoriteTrack } from '../entities/FavoriteTrack.entity';
import { RecentPlay } from '../entities/RecentPlay.entity';
import { Track } from '../entities/Track.entity';
import { User } from '../entities/User.entity';

export type PlayerTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  streamUrl: string;
  coverClass: string;
  coverUrl: string | null;
  mood: string;
  plays: string;
};

const audioExtensions = new Set(['.flac', '.mp3', '.m4a', '.ogg', '.wav']);
const coverClasses = [
  'cover-neon',
  'cover-coast',
  'cover-velvet',
  'cover-summer',
  'cover-blue',
];

@Injectable()
export class TracksService implements OnModuleInit {
  private readonly tracksPath = join(process.cwd(), 'uploads', 'tracks');

  constructor(
    @InjectRepository(Track)
    private readonly tracksRepository: Repository<Track>,
    @InjectRepository(FavoriteTrack)
    private readonly favoriteTracksRepository: Repository<FavoriteTrack>,
    @InjectRepository(RecentPlay)
    private readonly recentPlaysRepository: Repository<RecentPlay>,
  ) {}

  async onModuleInit() {
    await this.seedLocalTracks();
  }

  async listTracks() {
    const tracks = await this.tracksRepository.find({
      where: { isActive: true },
      order: {
        title: 'ASC',
      },
    });

    return {
      tracks: tracks.map((track, index) => this.serializeTrack(track, index)),
    };
  }

  async getTrackById(id: string) {
    return this.tracksRepository.findOne({
      where: {
        id: Number(id),
        isActive: true,
      },
    });
  }

  async listFavorites(userId: number) {
    const favorites = await this.favoriteTracksRepository.find({
      where: {
        user: { id: userId },
      },
      relations: {
        track: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return {
      tracks: favorites.map((favorite, index) =>
        this.serializeTrack(favorite.track, index),
      ),
    };
  }

  async favoriteTrack(userId: number, trackId: string) {
    const track = await this.getTrackById(trackId);

    if (!track) {
      return {
        message: 'Track not found.',
      };
    }

    const existingFavorite = await this.favoriteTracksRepository.findOne({
      where: {
        user: { id: userId },
        track: { id: track.id },
      },
    });

    if (!existingFavorite) {
      await this.favoriteTracksRepository.save(
        this.favoriteTracksRepository.create({
          user: { id: userId } as User,
          track,
        }),
      );
    }

    return {
      message: 'Track added to favorites.',
      track: this.serializeTrack(track, 0),
    };
  }

  async unfavoriteTrack(userId: number, trackId: string) {
    await this.favoriteTracksRepository
      .createQueryBuilder()
      .delete()
      .where('userId = :userId', { userId })
      .andWhere('trackId = :trackId', { trackId: Number(trackId) })
      .execute();

    return {
      message: 'Track removed from favorites.',
    };
  }

  async listRecentPlays(userId: number) {
    const recentPlays = await this.recentPlaysRepository.find({
      where: {
        user: { id: userId },
      },
      relations: {
        track: true,
      },
      order: {
        playedAt: 'DESC',
      },
      take: 25,
    });

    return {
      tracks: recentPlays.map((recentPlay, index) =>
        this.serializeTrack(recentPlay.track, index),
      ),
    };
  }

  async recordRecentPlay(
    userId: number,
    trackId: string,
    body: {
      progressSeconds?: number;
      completed?: boolean;
    },
  ) {
    const track = await this.getTrackById(trackId);

    if (!track) {
      return {
        message: 'Track not found.',
      };
    }

    await this.recentPlaysRepository.save(
      this.recentPlaysRepository.create({
        user: { id: userId } as User,
        track,
        progressSeconds: Math.max(0, Math.floor(body.progressSeconds ?? 0)),
        completed: Boolean(body.completed),
      }),
    );

    track.playCount += 1;
    await this.tracksRepository.save(track);

    return {
      message: 'Recent play recorded.',
      track: this.serializeTrack(track, 0),
    };
  }

  streamTrack(track: Track, range: string | undefined, response: Response) {
    const filePath = track.localFilePath
      ? join(process.cwd(), track.localFilePath)
      : '';

    if (!filePath || !existsSync(filePath)) {
      throw new InternalServerErrorException('Track file is missing.');
    }

    const fileSize = Number(track.sizeBytes);

    if (!range) {
      response.writeHead(200, {
        'Accept-Ranges': 'bytes',
        'Content-Length': fileSize,
        'Content-Type': track.mimeType,
      });

      return createReadStream(filePath).pipe(response);
    }

    const { start, end } = this.parseRange(range, fileSize);
    const chunkSize = end - start + 1;

    response.writeHead(206, {
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Type': track.mimeType,
    });

    return createReadStream(filePath, { start, end }).pipe(response);
  }

  private async seedLocalTracks() {
    if (!existsSync(this.tracksPath)) {
      return;
    }

    const fileNames = readdirSync(this.tracksPath)
      .filter((fileName) =>
        audioExtensions.has(extname(fileName).toLowerCase()),
      )
      .sort((first, second) => first.localeCompare(second));

    for (const fileName of fileNames) {
      await this.upsertLocalTrack(fileName);
    }
  }

  private async upsertLocalTrack(fileName: string) {
    const metadata = this.readLocalTrackMetadata(fileName);
    const existingTrack = await this.tracksRepository.findOne({
      where: { storageKey: metadata.storageKey },
    });

    if (existingTrack) {
      await this.tracksRepository.save({
        ...existingTrack,
        ...metadata,
        coverUrl: existingTrack.coverUrl ?? metadata.coverUrl,
        isActive: true,
      });
      return;
    }

    await this.tracksRepository.save(this.tracksRepository.create(metadata));
  }

  private readLocalTrackMetadata(fileName: string) {
    const filePath = join(this.tracksPath, fileName);
    const stats = statSync(filePath);
    const parsed = parse(fileName);
    const [rawTitle, rawArtist] = parsed.name.split(' - ');
    const title = rawTitle?.trim() || parsed.name;
    const artist = rawArtist?.trim() || 'Unknown Artist';
    const storageKey = `local:${Buffer.from(fileName).toString('base64url')}`;

    return {
      storageKey,
      title,
      artist,
      album: this.extractAlbum(title),
      duration: null,
      durationSeconds: null,
      genre: null,
      mood: 'Local',
      source: 'local' as const,
      streamUrl: null,
      coverUrl: null,
      localFileName: fileName,
      localFilePath: join('uploads', 'tracks', fileName),
      mimeType: this.getMimeType(parsed.ext),
      sizeBytes: String(stats.size),
      isActive: true,
    };
  }

  private serializeTrack(track: Track, index: number): PlayerTrack {
    return {
      id: String(track.id),
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration ?? '--:--',
      streamUrl: track.streamUrl ?? `/tracks/${track.id}/stream`,
      coverClass: coverClasses[index % coverClasses.length],
      coverUrl: track.coverUrl,
      mood: track.mood,
      plays: track.playCount ? `${track.playCount}` : 'Local',
    };
  }

  private extractAlbum(title: string) {
    const match = title.match(/\(From (.+)\)/i);

    return match?.[1] ?? 'Local Library';
  }

  private getMimeType(extension: string) {
    switch (extension.toLowerCase()) {
      case '.flac':
        return 'audio/flac';
      case '.m4a':
        return 'audio/mp4';
      case '.ogg':
        return 'audio/ogg';
      case '.wav':
        return 'audio/wav';
      case '.mp3':
      default:
        return 'audio/mpeg';
    }
  }

  private parseRange(range: string, fileSize: number) {
    const [startPart, endPart] = range.replace(/bytes=/, '').split('-');
    const start = Number.parseInt(startPart, 10);
    const end = endPart ? Number.parseInt(endPart, 10) : fileSize - 1;

    return {
      start: Number.isFinite(start) ? start : 0,
      end: Number.isFinite(end) ? Math.min(end, fileSize - 1) : fileSize - 1,
    };
  }
}
