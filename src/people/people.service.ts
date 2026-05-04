import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Singer } from '../entities/Singer.entity';
import { Artist } from '../entities/Artist.entity';
import { Lyricist } from '../entities/Lyricist.entity';

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
    const options: any = { order: { name: 'ASC' } };
    if (limit !== undefined) {
      options.skip = offset;
      options.take = limit;
    }
    const singers = await this.singerRepo.find(options);
    return { singers };
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
    const options: any = { order: { name: 'ASC' } };
    if (limit !== undefined) {
      options.skip = offset;
      options.take = limit;
    }
    const artists = await this.artistRepo.find(options);
    return { artists };
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
    const options: any = { order: { name: 'ASC' } };
    if (limit !== undefined) {
      options.skip = offset;
      options.take = limit;
    }
    const lyricists = await this.lyricistRepo.find(options);
    return { lyricists };
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
}
