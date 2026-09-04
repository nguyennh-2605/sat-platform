const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const required = name => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for object storage.`);
  return value;
};

let cached;

const getObjectStorage = () => {
  if (cached) return cached;
  const bucket = required('OBJECT_STORAGE_BUCKET');
  const region = process.env.OBJECT_STORAGE_REGION || 'auto';
  const endpoint = process.env.OBJECT_STORAGE_ENDPOINT || undefined;
  const accessKeyId = required('OBJECT_STORAGE_ACCESS_KEY_ID');
  const secretAccessKey = required('OBJECT_STORAGE_SECRET_ACCESS_KEY');
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === 'true',
    credentials: { accessKeyId, secretAccessKey },
  });

  cached = {
    provider: process.env.OBJECT_STORAGE_PROVIDER || 'S3_COMPATIBLE',
    async createUploadUrl({ storageKey, mimeType }) {
      const command = new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: mimeType });
      return getSignedUrl(client, command, { expiresIn: 15 * 60 });
    },
    async createReadUrl({ storageKey, downloadName }) {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      });
      return getSignedUrl(client, command, { expiresIn: 5 * 60 });
    },
    async headObject({ storageKey }) {
      const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: storageKey }));
      return { sizeBytes: Number(result.ContentLength), mimeType: result.ContentType || null };
    },
    async deleteObject({ storageKey }) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
    },
  };
  return cached;
};

module.exports = { getObjectStorage };
