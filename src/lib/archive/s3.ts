import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { FileArchive } from "./types.ts";
import { archiveKey } from "./types.ts";

export interface S3Options {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

/** Archives every upload in an S3 bucket (private; the URL is the object's, not a public link). */
export class S3Archive implements FileArchive {
  readonly kind = "s3" as const;
  private readonly client: S3Client;

  constructor(private readonly options: S3Options) {
    this.client = new S3Client({
      region: options.region,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
  }

  async save(data: Uint8Array, fileName: string, mimeType: string): Promise<string> {
    const key = archiveKey(fileName);
    await this.client.send(new PutObjectCommand({ Bucket: this.options.bucket, Key: key, Body: data, ContentType: mimeType }));
    return `s3://${this.options.bucket}/${key}`;
  }
}
