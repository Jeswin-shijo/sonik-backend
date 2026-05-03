import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, existsSync, readdirSync, statSync } from 'fs';
import { extname, join, parse } from 'path';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { FavoriteTrack } from '../entities/FavoriteTrack.entity';
import { QueueItem } from '../entities/QueueItem.entity';
import { RecentPlay } from '../entities/RecentPlay.entity';
import { Track } from '../entities/Track.entity';
import { User } from '../entities/User.entity';
import { UploadTrackDto } from './dto/upload-track.dto';
import { unlinkSync } from 'fs';

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

export type QueueMode = 'next' | 'end';

export type QueueTrack = {
  id: string;
  position: number;
  track: PlayerTrack;
};

export type LibraryArtist = {
  id: string;
  name: string;
  trackCount: number;
  albumCount: number;
  tracks: PlayerTrack[];
};

export type LibraryAlbum = {
  id: string;
  title: string;
  artist: string;
  trackCount: number;
  tracks: PlayerTrack[];
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
    @InjectRepository(QueueItem)
    private readonly queueItemsRepository: Repository<QueueItem>,
  ) {}

  async onModuleInit() {
    await this.seedLocalTracks();
  }

  async listTracks() {
    const tracks = await this.getActiveTracks();

    return {
      tracks: tracks.map((track, index) => this.serializeTrack(track, index)),
    };
  }

  async listArtists() {
    const tracks = await this.getActiveTracks();

    return {
      artists: this.buildArtists(tracks),
    };
  }

  async getArtistById(id: string) {
    const tracks = await this.getActiveTracks();
    const artist = this.buildArtists(tracks).find(
      (candidate) => candidate.id === id,
    );

    if (!artist) {
      throw new NotFoundException('Artist not found.');
    }

    return {
      artist,
    };
  }

  async listAlbums() {
    const tracks = await this.getActiveTracks();

    return {
      albums: this.buildAlbums(tracks),
    };
  }

  async getAlbumById(id: string) {
    const tracks = await this.getActiveTracks();
    const album = this.buildAlbums(tracks).find(
      (candidate) => candidate.id === id,
    );

    if (!album) {
      throw new NotFoundException('Album not found.');
    }

    return {
      album,
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

  async listQueue(userId: number) {
    const queueItems = await this.queueItemsRepository.find({
      where: {
        user: { id: userId },
      },
      relations: {
        track: true,
      },
      order: {
        position: 'ASC',
        createdAt: 'ASC',
      },
    });

    return {
      queue: queueItems.map((queueItem, index) =>
        this.serializeQueueItem(queueItem, index),
      ),
    };
  }

  async addToQueue(
    userId: number,
    trackId: string,
    mode: QueueMode = 'end',
  ) {
    const track = await this.getTrackById(trackId);

    if (!track) {
      throw new NotFoundException('Track not found.');
    }

    const position =
      mode === 'next'
        ? await this.reserveNextQueuePosition(userId)
        : await this.getNextQueuePosition(userId);

    const queueItem = await this.queueItemsRepository.save(
      this.queueItemsRepository.create({
        user: { id: userId } as User,
        track,
        position,
      }),
    );
    const queue = await this.listQueue(userId);

    return {
      message:
        mode === 'next' ? 'Track will play next.' : 'Track added to queue.',
      queueItem: this.serializeQueueItem(queueItem, position),
      queue: queue.queue,
    };
  }

  async removeQueueItem(userId: number, queueItemId: string) {
    await this.queueItemsRepository
      .createQueryBuilder()
      .delete()
      .where('id = :queueItemId', { queueItemId: Number(queueItemId) })
      .andWhere('userId = :userId', { userId })
      .execute();

    return this.listQueue(userId);
  }

  async clearQueue(userId: number) {
    await this.queueItemsRepository
      .createQueryBuilder()
      .delete()
      .where('userId = :userId', { userId })
      .execute();

    return {
      queue: [],
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

  async uploadTrack(
    metadata: UploadTrackDto,
    audioFile: Express.Multer.File,
    coverFile: Express.Multer.File | undefined,
  ) {
    const storageKey = `local:${Buffer.from(audioFile.filename).toString('base64url')}`;
    const localFilePath = join('uploads', 'tracks', audioFile.filename);
    const coverUrl = coverFile
      ? `/uploads/covers/${coverFile.filename}`
      : null;

    const track = this.tracksRepository.create({
      storageKey,
      title: metadata.title.trim(),
      artist: metadata.artist?.trim() || 'Unknown Artist',
      album: metadata.album?.trim() || 'Local Library',
      genre: metadata.genre?.trim() || null,
      mood: metadata.mood?.trim() || 'Local',
      source: 'local' as const,
      streamUrl: null,
      coverUrl,
      localFileName: audioFile.filename,
      localFilePath,
      mimeType: audioFile.mimetype || 'audio/mpeg',
      sizeBytes: String(audioFile.size),
      isActive: true,
    });

    const saved = await this.tracksRepository.save(track);

    return {
      message: 'Track uploaded successfully.',
      track: this.serializeTrack(saved, 0),
    };
  }

  async deactivateTrack(trackId: string) {
    const track = await this.tracksRepository.findOne({
      where: { id: Number(trackId) },
    });

    if (!track) {
      throw new NotFoundException('Track not found.');
    }

    track.isActive = false;
    await this.tracksRepository.save(track);

    if (track.localFilePath) {
      const absolute = join(process.cwd(), track.localFilePath);
      try {
        if (existsSync(absolute)) {
          unlinkSync(absolute);
        }
      } catch {
        // best-effort cleanup; row stays inactive even if file delete fails
      }
    }

    return { message: 'Track removed.' };
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

  private getActiveTracks() {
    return this.tracksRepository.find({
      where: { isActive: true },
      order: {
        title: 'ASC',
      },
    });
  }

  private buildArtists(tracks: Track[]): LibraryArtist[] {
    const artists = new Map<
      string,
      {
        id: string;
        name: string;
        albums: Set<string>;
        tracks: PlayerTrack[];
      }
    >();

    tracks.forEach((track, index) => {
      const name = track.artist || 'Unknown Artist';
      const id = this.getCollectionId(name);
      const artist = artists.get(id) ?? {
        id,
        name,
        albums: new Set<string>(),
        tracks: [],
      };

      artist.albums.add(track.album || 'Local Library');
      artist.tracks.push(this.serializeTrack(track, index));
      artists.set(id, artist);
    });

    return [...artists.values()]
      .map((artist) => ({
        id: artist.id,
        name: artist.name,
        trackCount: artist.tracks.length,
        albumCount: artist.albums.size,
        tracks: artist.tracks,
      }))
      .sort((first, second) => first.name.localeCompare(second.name));
  }

  private buildAlbums(tracks: Track[]): LibraryAlbum[] {
    const albums = new Map<
      string,
      {
        id: string;
        title: string;
        artist: string;
        tracks: PlayerTrack[];
      }
    >();

    tracks.forEach((track, index) => {
      const title = track.album || 'Local Library';
      const artist = track.artist || 'Unknown Artist';
      const key = `${title}\u0000${artist}`;
      const id = this.getCollectionId(key);
      const album = albums.get(id) ?? {
        id,
        title,
        artist,
        tracks: [],
      };

      album.tracks.push(this.serializeTrack(track, index));
      albums.set(id, album);
    });

    return [...albums.values()]
      .map((album) => ({
        id: album.id,
        title: album.title,
        artist: album.artist,
        trackCount: album.tracks.length,
        tracks: album.tracks,
      }))
      .sort((first, second) => first.title.localeCompare(second.title));
  }

  private getCollectionId(value: string) {
    return Buffer.from(value).toString('base64url');
  }

  private serializeQueueItem(queueItem: QueueItem, index: number): QueueTrack {
    return {
      id: String(queueItem.id),
      position: queueItem.position,
      track: this.serializeTrack(queueItem.track, index),
    };
  }

  private async getNextQueuePosition(userId: number) {
    const result = await this.queueItemsRepository
      .createQueryBuilder('queueItem')
      .select('MAX(queueItem.position)', 'max')
      .where('queueItem.userId = :userId', { userId })
      .getRawOne<{ max: string | number | null }>();
    const currentMax = Number(result?.max ?? -1);

    return Number.isFinite(currentMax) ? currentMax + 1 : 0;
  }

  private async reserveNextQueuePosition(userId: number) {
    await this.queueItemsRepository
      .createQueryBuilder()
      .update(QueueItem)
      .set({
        position: () => 'position + 1',
      })
      .where('userId = :userId', { userId })
      .execute();

    return 0;
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
      where: { localFileName: fileName },
    });

    if (existingTrack) {
      await this.tracksRepository.save({
        ...existingTrack,
        localFileName: fileName,
        localFilePath: metadata.localFilePath,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
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
