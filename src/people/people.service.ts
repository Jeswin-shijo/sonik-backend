import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Singer } from '../entities/Singer.entity';
import { Artist } from '../entities/Artist.entity';
import { Lyricist } from '../entities/Lyricist.entity';
import { Track } from '../entities/Track.entity';

const coverClasses = ['cover-neon', 'cover-coast', 'cover-velvet', 'cover-summer', 'cover-blue'];

@Injectable()
export class PeopleService {
  constructor(
    @InjectRepository(Singer)
    private readonly singerRepo: Repository<Singer>,
    @InjectRepository(Artist)
    private readonly artistRepo: Repository<Artist>,
    @InjectRepository(Lyricist)
    private readonly lyricistRepo: Repository<Lyricist>,
  ) {}

  async listSingers(offset = 0, limit?: number) {
    const qb = this.singerRepo
      .createQueryBuilder('singer')
      .leftJoinAndSelect('singer.tracks', 'track', 'track.isActive = true')
      .leftJoinAndSelect('track.artistRelation', 'artistRelation')
      .leftJoinAndSelect('track.lyricist', 'lyricist')
      .orderBy('singer.name', 'ASC');

    if (limit !== undefined) {
      qb.skip(offset).take(limit);
    }

    const singers = await qb.getMany();
    return { singers: singers.map((s) => this.serializeSinger(s)) };
  }

  async createSinger(name: string, imageFile?: Express.Multer.File) {
    if (!name?.trim()) throw new BadRequestException('Name is required');
    const singer = this.singerRepo.create({
      name: name.trim(),
      imageName: imageFile ? imageFile.filename : null,
    });
    const saved = await this.singerRepo.save(singer);
    return { message: 'Singer added successfully', singer: saved };
  }

  async updateSinger(id: number, name?: string, imageFile?: Express.Multer.File) {
    const singer = await this.singerRepo.findOneBy({ id });
    if (!singer) throw new NotFoundException('Singer not found');
    if (name?.trim()) singer.name = name.trim();
    if (imageFile) singer.imageName = imageFile.filename;
    const saved = await this.singerRepo.save(singer);
    return { message: 'Singer updated successfully', singer: saved };
  }

  async deleteSinger(id: number) {
    const res = await this.singerRepo.delete(id);
    if (res.affected === 0) throw new NotFoundException('Singer not found');
    return { message: 'Singer deleted' };
  }

  async listArtists(offset = 0, limit?: number) {
    const qb = this.artistRepo
      .createQueryBuilder('artist')
      .leftJoinAndSelect('artist.tracks', 'track', 'track.isActive = true')
      .leftJoinAndSelect('track.singer', 'singer')
      .leftJoinAndSelect('track.lyricist', 'lyricist')
      .orderBy('artist.name', 'ASC');

    if (limit !== undefined) {
      qb.skip(offset).take(limit);
    }

    const artists = await qb.getMany();
    return { artists: artists.map((a) => this.serializeArtist(a)) };
  }

  async createArtist(name: string, imageFile?: Express.Multer.File) {
    if (!name?.trim()) throw new BadRequestException('Name is required');
    const artist = this.artistRepo.create({
      name: name.trim(),
      imageName: imageFile ? imageFile.filename : null,
    });
    const saved = await this.artistRepo.save(artist);
    return { message: 'Artist added successfully', artist: saved };
  }

  async updateArtist(id: number, name?: string, imageFile?: Express.Multer.File) {
    const artist = await this.artistRepo.findOneBy({ id });
    if (!artist) throw new NotFoundException('Artist not found');
    if (name?.trim()) artist.name = name.trim();
    if (imageFile) artist.imageName = imageFile.filename;
    const saved = await this.artistRepo.save(artist);
    return { message: 'Artist updated successfully', artist: saved };
  }

  async deleteArtist(id: number) {
    const res = await this.artistRepo.delete(id);
    if (res.affected === 0) throw new NotFoundException('Artist not found');
    return { message: 'Artist deleted' };
  }

  async listLyricists(offset = 0, limit?: number) {
    const qb = this.lyricistRepo
      .createQueryBuilder('lyricist')
      .leftJoinAndSelect('lyricist.tracks', 'track', 'track.isActive = true')
      .leftJoinAndSelect('track.singer', 'singer')
      .leftJoinAndSelect('track.artistRelation', 'artistRelation')
      .orderBy('lyricist.name', 'ASC');

    if (limit !== undefined) {
      qb.skip(offset).take(limit);
    }

    const lyricists = await qb.getMany();
    return { lyricists: lyricists.map((l) => this.serializeLyricist(l)) };
  }

  async createLyricist(name: string, imageFile?: Express.Multer.File) {
    if (!name?.trim()) throw new BadRequestException('Name is required');
    const lyricist = this.lyricistRepo.create({
      name: name.trim(),
      imageName: imageFile ? imageFile.filename : null,
    });
    const saved = await this.lyricistRepo.save(lyricist);
    return { message: 'Lyricist added successfully', lyricist: saved };
  }

  async updateLyricist(id: number, name?: string, imageFile?: Express.Multer.File) {
    const lyricist = await this.lyricistRepo.findOneBy({ id });
    if (!lyricist) throw new NotFoundException('Lyricist not found');
    if (name?.trim()) lyricist.name = name.trim();
    if (imageFile) lyricist.imageName = imageFile.filename;
    const saved = await this.lyricistRepo.save(lyricist);
    return { message: 'Lyricist updated successfully', lyricist: saved };
  }

  async deleteLyricist(id: number) {
    const res = await this.lyricistRepo.delete(id);
    if (res.affected === 0) throw new NotFoundException('Lyricist not found');
    return { message: 'Lyricist deleted' };
  }

  private serializePeopleTrack(track: Track, index: number) {
    let coverUrl = track.coverUrl ?? null;
    if (coverUrl && !coverUrl.includes('/')) {
      coverUrl = `/uploads/covers/${coverUrl}`;
    }
    return {
      id: String(track.id),
      title: track.title,
      artist: track.artistRelation ? (track.artistRelation as any).name : track.artist,
      album: track.album,
      duration: track.duration ?? '--:--',
      streamUrl: track.streamUrl ?? `/tracks/${track.id}/stream`,
      coverClass: coverClasses[index % coverClasses.length],
      coverUrl,
      mood: track.mood,
      plays: track.playCount ? `${track.playCount}` : 'Local',
      singerId: track.singer ? String((track.singer as any).id ?? '') : '',
      artistId: track.artistRelation ? String((track.artistRelation as any).id ?? '') : '',
      lyricistId: track.lyricist ? String((track.lyricist as any).id ?? '') : '',
      genre: track.genre ?? '',
    };
  }

  private serializeSinger(singer: Singer) {
    const activeTracks = (singer.tracks ?? []).filter((t) => t.isActive);
    return {
      id: String(singer.id),
      name: singer.name,
      imageName: singer.imageName,
      trackCount: activeTracks.length,
      tracks: activeTracks.map((t, i) => this.serializePeopleTrack(t, i)),
    };
  }

  private serializeArtist(artist: Artist) {
    const activeTracks = (artist.tracks ?? []).filter((t) => t.isActive);
    const albums = new Set(activeTracks.map((t) => t.album));
    return {
      id: String(artist.id),
      name: artist.name,
      imageName: artist.imageName,
      trackCount: activeTracks.length,
      albumCount: albums.size,
      tracks: activeTracks.map((t, i) => this.serializePeopleTrack(t, i)),
    };
  }

  private serializeLyricist(lyricist: Lyricist) {
    const activeTracks = (lyricist.tracks ?? []).filter((t) => t.isActive);
    return {
      id: String(lyricist.id),
      name: lyricist.name,
      imageName: lyricist.imageName,
      trackCount: activeTracks.length,
      tracks: activeTracks.map((t, i) => this.serializePeopleTrack(t, i)),
    };
  }
}
