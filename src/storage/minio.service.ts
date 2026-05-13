import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import type { Readable } from 'stream';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: Minio.Client;
  readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get<string>('MINIO_BUCKET_NAME', 'sonik-songs');
    this.client = new Minio.Client({
      endPoint: config.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: Number(config.get<string>('MINIO_PORT', '9000')),
      useSSL: config.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: config.get<string>('MINIO_ACCESS_KEY', ''),
      secretKey: config.get<string>('MINIO_SECRET_KEY', ''),
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Created MinIO bucket: ${this.bucket}`);
      } else {
        this.logger.log(`MinIO bucket ready: ${this.bucket}`);
      }
    } catch (err) {
      this.logger.error('MinIO initialization failed', err);
    }
  }

  async upload(objectKey: string, filePath: string, contentType: string): Promise<void> {
    await this.client.fPutObject(this.bucket, objectKey, filePath, {
      'Content-Type': contentType,
    });
  }

  async getObject(objectKey: string): Promise<Readable> {
    return this.client.getObject(this.bucket, objectKey);
  }

  async getPartialObject(objectKey: string, offset: number, length: number): Promise<Readable> {
    return this.client.getPartialObject(this.bucket, objectKey, offset, length);
  }

  async statObject(objectKey: string): Promise<Minio.BucketItemStat> {
    return this.client.statObject(this.bucket, objectKey);
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectKey);
  }
}
