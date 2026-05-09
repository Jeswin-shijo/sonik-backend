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
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { unlinkSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

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
    private readonly realtime: RealtimeGateway,
  ) {}

  async onModuleInit() {
    await this.seedLocalTracks();
  }

  async listTracks(offset = 0, limit?: number) {
    const tracks = await this.getActiveTracks(offset, limit);

    return {
      tracks: tracks.map((track, index) =>
        this.serializeTrack(track, index + offset),
      ),
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

  async searchTracks(query: string, offset = 0, limit = 30) {
    const q = `%${query.trim().toLowerCase()}%`;

    const tracks = await this.tracksRepository
      .createQueryBuilder('track')
      .leftJoinAndSelect('track.singer', 'singer')
      .leftJoinAndSelect('track.artistRelation', 'artistRelation')
      .leftJoinAndSelect('track.lyricist', 'lyricist')
      .where('track.isActive = :isActive', { isActive: true })
      .andWhere(
        '(LOWER(track.title) LIKE :q OR LOWER(track.artist) LIKE :q OR LOWER(track.album) LIKE :q OR LOWER(track.mood) LIKE :q OR LOWER(track.genre) LIKE :q)',
        { q },
      )
      .orderBy('track.playCount', 'DESC')
      .addOrderBy('track.title', 'ASC')
      .skip(offset)
      .take(limit)
      .getMany();

    return {
      tracks: tracks.map((track, index) => this.serializeTrack(track, index + offset)),
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

    this.realtime.emit({ type: 'track:liked', trackId, userId });
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

    this.realtime.emit({ type: 'track:unliked', trackId, userId });
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

  async addToQueue(userId: number, trackId: string, mode: QueueMode = 'end') {
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
    audioFile: Express.Multer.File | undefined,
    coverFile: Express.Multer.File | undefined,
  ) {
    const providedAudioName = metadata.audioFileName?.trim() || null;
    const providedCoverName = metadata.coverImageName?.trim() || null;

    const finalAudioFileName =
      audioFile?.filename ||
      providedAudioName ||
      `draft-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const storageKey = `local:${Buffer.from(finalAudioFileName).toString('base64url')}`;

    const isExternalUrl =
      providedAudioName?.startsWith('http://') ||
      providedAudioName?.startsWith('https://');

    let localFilePath: any = null;
    let streamUrl: string | null = null;
    let source: 'local' | 'remote' = 'local';
    let fileSizeBytes = audioFile?.size || 0;
    let fileMimeType = audioFile?.mimetype || 'audio/mpeg';

    if (audioFile) {
      localFilePath = join('uploads', 'tracks', audioFile.filename);
    } else if (providedAudioName) {
      if (isExternalUrl) {
        streamUrl = providedAudioName;
        source = 'remote';
      } else {
        localFilePath = join('uploads', 'tracks', providedAudioName);
        // Read actual file stats when referencing an existing file by name
        const absolutePath = join(
          process.cwd(),
          'uploads',
          'tracks',
          providedAudioName,
        );
        if (existsSync(absolutePath)) {
          fileSizeBytes = statSync(absolutePath).size;
          fileMimeType = this.getMimeType(extname(providedAudioName));
        }
      }
    }

    const coverUrl = coverFile ? coverFile.filename : providedCoverName;
    const finalStorageKey = isExternalUrl
      ? `remote:${Buffer.from(providedAudioName!).toString('base64url')}`
      : storageKey;

    // Check for existing track (may have been deactivated) by storageKey or localFileName
    const existingTrack =
      (await this.tracksRepository.findOne({
        where: { storageKey: finalStorageKey },
      })) ??
      (providedAudioName && !isExternalUrl
        ? await this.tracksRepository.findOne({
            where: { localFileName: providedAudioName },
          })
        : null);

    const trackData = {
      storageKey: finalStorageKey,
      title: metadata.title.trim(),
      artist: metadata.artist?.trim() || 'Unknown Artist',
      singer: metadata.singerId ? { id: Number(metadata.singerId) } : null,
      artistRelation: metadata.artistId
        ? { id: Number(metadata.artistId) }
        : null,
      lyricist: metadata.lyricistId
        ? { id: Number(metadata.lyricistId) }
        : null,
      album: metadata.album?.trim() || 'Local Library',
      genre: metadata.genre?.trim() || null,
      language: metadata.language?.trim() || null,
      mood: metadata.mood?.trim() || 'Local',
      source,
      streamUrl,
      coverUrl,
      coverName: coverUrl,
      localFileName:
        audioFile?.filename || (!isExternalUrl ? providedAudioName : null),
      localFilePath,
      mimeType: fileMimeType,
      sizeBytes: String(fileSizeBytes),
      isActive: true,
    };

    if (audioFile) {
      // Convert non-OGG media files (including video) to OGG
      const converted = await this.convertToOggIfNeeded(audioFile);
      if (converted) {
        localFilePath = join('uploads', 'tracks', converted.filename);
        fileSizeBytes = converted.size;
        fileMimeType = 'audio/ogg';
        trackData.localFilePath = localFilePath;
        trackData.localFileName = converted.filename;
        trackData.mimeType = fileMimeType;
        trackData.sizeBytes = String(fileSizeBytes);
        // Update storageKey based on new filename
        const newStorageKey = `local:${Buffer.from(converted.filename).toString('base64url')}`;
        trackData.storageKey = newStorageKey;
      }
    }

    const saved = existingTrack
      ? await this.tracksRepository.save({ ...existingTrack, ...trackData })
      : await this.tracksRepository.save(
          this.tracksRepository.create(trackData),
        );

    const serialized = this.serializeTrack(saved, 0);
    this.realtime.emit({ type: 'track:added', track: serialized as Record<string, unknown> });
    this.realtime.emit({ type: 'notification', message: `New track added: ${serialized.title}`, kind: 'success' });
    return {
      message: 'Track uploaded successfully.',
      track: serialized,
    };
  }

  async updateTrack(
    trackId: string,
    metadata: Partial<UploadTrackDto>,
    audioFile?: Express.Multer.File,
    coverFile?: Express.Multer.File,
  ) {
    const track = await this.getTrackById(trackId);
    if (!track) throw new NotFoundException('Track not found.');

    if (metadata.title) track.title = metadata.title.trim();
    if (metadata.artist) track.artist = metadata.artist.trim();
    if (metadata.singerId !== undefined)
      track.singer = metadata.singerId
        ? ({ id: Number(metadata.singerId) } as any)
        : null;
    if (metadata.artistId !== undefined)
      track.artistRelation = metadata.artistId
        ? ({ id: Number(metadata.artistId) } as any)
        : null;
    if (metadata.lyricistId !== undefined)
      track.lyricist = metadata.lyricistId
        ? ({ id: Number(metadata.lyricistId) } as any)
        : null;
    if (metadata.album) track.album = metadata.album.trim();
    if (metadata.genre !== undefined)
      track.genre = metadata.genre?.trim() || null;
    if (metadata.language !== undefined)
      track.language = metadata.language?.trim() || null;
    if (metadata.mood !== undefined)
      track.mood = metadata.mood?.trim() || 'Local';

    if (metadata.audioFileName !== undefined && !audioFile) {
      const audioName = metadata.audioFileName?.trim() || null;
      const isExt =
        audioName?.startsWith('http://') || audioName?.startsWith('https://');

      if (isExt) {
        track.source = 'remote';
        track.streamUrl = audioName;
        track.localFileName = null;
        track.localFilePath = null;
      } else {
        track.source = 'local';
        track.streamUrl = null;
        track.localFileName = audioName;
        track.localFilePath = audioName
          ? join('uploads', 'tracks', audioName)
          : null;
      }
    }

    if (metadata.coverImageName !== undefined && !coverFile) {
      track.coverUrl = metadata.coverImageName?.trim() || null;
      track.coverName = metadata.coverImageName?.trim() || null;
    }

    if (audioFile) {
      track.localFileName = audioFile.filename;
      track.localFilePath = join('uploads', 'tracks', audioFile.filename);
      track.mimeType = audioFile.mimetype || 'audio/mpeg';
      track.sizeBytes = String(audioFile.size);
      track.storageKey = `local:${Buffer.from(audioFile.filename).toString('base64url')}`;
    }

    if (coverFile) {
      track.coverUrl = coverFile.filename;
      track.coverName = coverFile.filename;
    }

    const saved = await this.tracksRepository.save(track);
    const serialized = this.serializeTrack(saved, 0);
    this.realtime.emit({ type: 'track:updated', track: serialized as Record<string, unknown> });
    return {
      message: 'Track updated successfully.',
      track: serialized,
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

    this.realtime.emit({ type: 'track:deleted', trackId });
    this.realtime.emit({ type: 'notification', message: `Track "${track.title}" was removed`, kind: 'warning' });
    return { message: 'Track removed.' };
  }

  streamTrack(track: Track, range: string | undefined, response: Response) {
    const filePath = track.localFilePath
      ? join(process.cwd(), track.localFilePath)
      : '';

    if (!filePath || !existsSync(filePath)) {
      throw new InternalServerErrorException('Track file is missing.');
    }

    const storedSize = Number(track.sizeBytes);
    const fileSize = storedSize > 0 ? storedSize : statSync(filePath).size;

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

  private getActiveTracks(offset = 0, limit?: number) {
    const options: any = {
      where: { isActive: true },
      relations: ['singer', 'artistRelation', 'lyricist'],
      order: {
        title: 'ASC',
      },
    };
    if (limit !== undefined) {
      options.skip = offset;
      options.take = limit;
    }
    return this.tracksRepository.find(options);
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

  async listLanguages() {
    const tracks = await this.getActiveTracks();
    return { languages: this.buildLanguages(tracks) };
  }

  async getLanguageById(id: string) {
    const tracks = await this.getActiveTracks();
    const language = this.buildLanguages(tracks).find((l) => l.id === id);
    if (!language) throw new NotFoundException('Language not found.');
    return language;
  }

  private buildLanguages(tracks: Track[]) {
    const map = new Map<string, { id: string; name: string; tracks: PlayerTrack[] }>();

    tracks.forEach((track, index) => {
      if (!track.language?.trim()) return;
      const name = track.language.trim();
      const id = this.getCollectionId(name);
      const lang = map.get(id) ?? { id, name, tracks: [] };
      lang.tracks.push(this.serializeTrack(track, index));
      map.set(id, lang);
    });

    return [...map.values()]
      .map((l) => ({ id: l.id, name: l.name, trackCount: l.tracks.length, tracks: l.tracks }))
      .sort((a, b) => a.name.localeCompare(b.name));
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
    const existingTrack =
      (await this.tracksRepository.findOne({
        where: { localFileName: fileName },
      })) ??
      (await this.tracksRepository.findOne({
        where: { storageKey: metadata.storageKey },
      }));

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
      coverName: null,
      localFileName: fileName,
      localFilePath: join('uploads', 'tracks', fileName),
      mimeType: this.getMimeType(parsed.ext),
      sizeBytes: String(stats.size),
      isActive: true,
    };
  }

  private serializeTrack(track: Track, index: number): any {
    let finalCoverUrl = track.coverUrl;
    if (finalCoverUrl && !finalCoverUrl.includes('/')) {
      finalCoverUrl = `/uploads/covers/${finalCoverUrl}`;
    }

    return {
      id: String(track.id),
      title: track.title,
      artist: track.artistRelation
        ? (track.artistRelation as any).name
        : track.artist,
      album: track.album,
      duration: track.duration ?? '--:--',
      streamUrl: track.streamUrl ?? `/tracks/${track.id}/stream`,
      coverClass: coverClasses[index % coverClasses.length],
      coverUrl: finalCoverUrl,
      mood: track.mood,
      plays: track.playCount ? `${track.playCount}` : 'Local',
      singerId: track.singer ? String((track.singer as any).id) : '',
      artistId: track.artistRelation
        ? String((track.artistRelation as any).id)
        : '',
      lyricistId: track.lyricist ? String((track.lyricist as any).id) : '',
      genre: track.genre || '',
      language: track.language || '',
      localFileName: track.localFileName || '',
      coverName: track.coverName || '',
    };
  }

  private extractAlbum(title: string) {
    const match = title.match(/\(From (.+)\)/i);

    return match?.[1] ?? 'Local Library';
  }

  /**
   * Convert uploaded media files (audio/video) to OGG format using FFmpeg.
   * Returns null if the file is already OGG and no conversion is needed.
   */
  private async convertToOggIfNeeded(
    audioFile: Express.Multer.File,
  ): Promise<{ filename: string; size: number } | null> {
    const ext = extname(audioFile.filename).toLowerCase();
    if (ext === '.ogg') {
      return null; // already OGG, no conversion needed
    }

    const inputPath = join(process.cwd(), 'uploads', 'tracks', audioFile.filename);
    const baseName = parse(audioFile.filename).name;
    const oggFilename = `${baseName}.ogg`;
    const outputPath = join(process.cwd(), 'uploads', 'tracks', oggFilename);

    try {
      await execFileAsync('ffmpeg', [
        '-i', inputPath,
        '-vn',              // strip video stream
        '-codec:a', 'libvorbis',
        '-q:a', '6',       // quality level 6 (~192kbps VBR)
        '-y',               // overwrite output
        outputPath,
      ]);

      // Remove the original uploaded file
      try {
        if (existsSync(inputPath)) {
          unlinkSync(inputPath);
        }
      } catch {
        // best-effort cleanup
      }

      const stats = statSync(outputPath);
      return { filename: oggFilename, size: stats.size };
    } catch (error) {
      console.error('FFmpeg conversion failed:', error);
      // If conversion fails, keep the original file as-is
      return null;
    }
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
