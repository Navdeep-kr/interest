import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly cdnBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID', 'minioadmin');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY', 'minioadmin');

    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME', 'interest-reels');
    this.cdnBaseUrl = this.configService.get<string>(
      'CDN_BASE_URL',
      endpoint ? `${endpoint}/${this.bucketName}` : `https://${this.bucketName}.s3.amazonaws.com`,
    );

    this.s3Client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: !!endpoint, // Required for MinIO / LocalStack
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Generates a pre-signed PUT URL for direct client-to-S3 single-part upload.
   */
  async getPresignedUploadUrl(
    s3Key: string,
    contentType: string,
    expiresInSeconds: number = 900,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ContentType: contentType,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Initiates an S3 multipart upload for large video files.
   */
  async initiateMultipartUpload(s3Key: string, contentType: string): Promise<string> {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ContentType: contentType,
    });
    const res = await this.s3Client.send(command);
    return res.UploadId!;
  }

  /**
   * Generates a pre-signed URL for an individual part in a multipart upload.
   */
  async getPresignedPartUrl(
    s3Key: string,
    uploadId: string,
    partNumber: number,
    expiresInSeconds: number = 1800,
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Completes the S3 multipart upload and assembles parts into a single video object.
   */
  async completeMultipartUpload(
    s3Key: string,
    uploadId: string,
    parts: Array<{ PartNumber: number; ETag: string }>,
  ): Promise<string> {
    const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts,
      },
    });
    await this.s3Client.send(command);
    return `${this.cdnBaseUrl}/${s3Key}`;
  }

  /**
   * Aborts an incomplete multipart upload to clean up storage.
   */
  async abortMultipartUpload(s3Key: string, uploadId: string): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      UploadId: uploadId,
    });
    await this.s3Client.send(command);
  }

  /**
   * Downloads a remote S3 object to local disk for FFmpeg transcoding.
   */
  async downloadFile(s3Key: string, destinationPath: string): Promise<void> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });
    const response = await this.s3Client.send(command);
    const stream = response.Body as NodeJS.ReadableStream;
    return new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(destinationPath);
      stream.pipe(fileStream);
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });
  }

  /**
   * Uploads a local file buffer or stream to S3.
   */
  async uploadFile(s3Key: string, body: Buffer | Uint8Array, contentType: string): Promise<string> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: body,
        ContentType: contentType,
      }),
    );

    return `${this.cdnBaseUrl}/${s3Key}`;
  }

  /**
   * Uploads an entire directory of HLS files (master.m3u8, variants, and .ts segments) to S3.
   */
  async uploadHlsDirectory(localDir: string, s3Prefix: string): Promise<string> {
    const files = fs.readdirSync(localDir);

    for (const file of files) {
      const fullPath = path.join(localDir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        await this.uploadHlsDirectory(fullPath, `${s3Prefix}/${file}`);
      } else {
        const fileContent = fs.readFileSync(fullPath);
        let contentType = 'application/octet-stream';

        if (file.endsWith('.m3u8')) {
          contentType = 'application/vnd.apple.mpegurl';
        } else if (file.endsWith('.ts')) {
          contentType = 'video/mp2t';
        } else if (file.endsWith('.jpg') || file.endsWith('.jpeg')) {
          contentType = 'image/jpeg';
        } else if (file.endsWith('.aac') || file.endsWith('.m4a')) {
          contentType = 'audio/aac';
        }

        const s3Key = `${s3Prefix}/${file}`;
        await this.uploadFile(s3Key, fileContent, contentType);
      }
    }

    return `${this.cdnBaseUrl}/${s3Prefix}/master.m3u8`;
  }

  getPublicUrl(s3Key: string): string {
    return `${this.cdnBaseUrl}/${s3Key}`;
  }
}
