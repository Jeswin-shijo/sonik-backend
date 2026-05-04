import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import { PeopleService } from './people.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function uniqueFileName(originalName: string) {
  const stamp = Date.now();
  const random = randomBytes(6).toString('hex');
  return `${stamp}-${random}${extname(originalName).toLowerCase()}`;
}

const fileInterceptorConfig = {
  storage: diskStorage({
    destination: join(process.cwd(), 'uploads', 'people'),
    filename: (_req, file, callback) => {
      callback(null, uniqueFileName(file.originalname));
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req: any, file: any, callback: any) => {
    if (!imageMimeTypes.includes(file.mimetype)) {
      return callback(
        new BadRequestException(`Unsupported image type: ${file.mimetype}`),
        false,
      );
    }
    callback(null, true);
  },
};

@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get('singers')
  listSingers(
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.peopleService.listSingers(
      offset ? parseInt(offset, 10) : 0,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('singers')
  @UseInterceptors(FileInterceptor('image', fileInterceptorConfig))
  createSinger(
    @Body('name') name: string,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.peopleService.createSinger(name, image);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('singers/:id')
  @UseInterceptors(FileInterceptor('image', fileInterceptorConfig))
  updateSinger(
    @Param('id') id: string,
    @Body('name') name?: string,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.peopleService.updateSinger(parseInt(id, 10), name, image);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('singers/:id')
  deleteSinger(@Param('id') id: string) {
    return this.peopleService.deleteSinger(parseInt(id, 10));
  }

  @Get('artists')
  listArtists(
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.peopleService.listArtists(
      offset ? parseInt(offset, 10) : 0,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('artists')
  @UseInterceptors(FileInterceptor('image', fileInterceptorConfig))
  createArtist(
    @Body('name') name: string,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.peopleService.createArtist(name, image);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('artists/:id')
  @UseInterceptors(FileInterceptor('image', fileInterceptorConfig))
  updateArtist(
    @Param('id') id: string,
    @Body('name') name?: string,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.peopleService.updateArtist(parseInt(id, 10), name, image);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('artists/:id')
  deleteArtist(@Param('id') id: string) {
    return this.peopleService.deleteArtist(parseInt(id, 10));
  }

  @Get('lyricists')
  listLyricists(
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.peopleService.listLyricists(
      offset ? parseInt(offset, 10) : 0,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('lyricists')
  @UseInterceptors(FileInterceptor('image', fileInterceptorConfig))
  createLyricist(
    @Body('name') name: string,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.peopleService.createLyricist(name, image);
  }
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('lyricists/:id')
  @UseInterceptors(FileInterceptor('image', fileInterceptorConfig))
  updateLyricist(
    @Param('id') id: string,
    @Body('name') name?: string,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.peopleService.updateLyricist(parseInt(id, 10), name, image);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('lyricists/:id')
  deleteLyricist(@Param('id') id: string) {
    return this.peopleService.deleteLyricist(parseInt(id, 10));
  }
}
