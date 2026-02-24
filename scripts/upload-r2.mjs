/**
 * Upload de arquivo grande para Cloudflare R2 via S3 API (multipart)
 * Uso: node scripts/upload-r2.mjs
 *
 * Requer variáveis de ambiente:
 *   R2_ACCESS_KEY_ID     - Access Key ID do R2 API Token
 *   R2_SECRET_ACCESS_KEY - Secret Access Key do R2 API Token
 *   R2_ACCOUNT_ID        - Account ID do Cloudflare (aparece no endpoint do token)
 */

import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { createReadStream, statSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;

if (!ACCESS_KEY || !SECRET_KEY || !ACCOUNT_ID) {
  console.error('❌ Defina as variáveis: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID');
  console.error('');
  console.error('Exemplo:');
  console.error('  set R2_ACCESS_KEY_ID=sua_access_key');
  console.error('  set R2_SECRET_ACCESS_KEY=sua_secret_key');
  console.error('  set R2_ACCOUNT_ID=seu_account_id');
  console.error('  node scripts/upload-r2.mjs');
  process.exit(1);
}

const BUCKET = 'openwork-releases';
const FILE_PATH = path.join(__dirname, '../apps/desktop/release/Juris IA-0.3.5-win-x64.exe');
const OBJECT_KEY = 'beta/latest/openwork-setup.exe';
const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB por parte

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

async function uploadMultipart() {
  const fileSize = statSync(FILE_PATH).size;
  const totalParts = Math.ceil(fileSize / CHUNK_SIZE);

  console.log(`📦 Arquivo: ${FILE_PATH}`);
  console.log(`📏 Tamanho: ${(fileSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`🔢 Partes: ${totalParts} x ~${CHUNK_SIZE / 1024 / 1024}MB`);
  console.log(`🎯 Destino: r2://${BUCKET}/${OBJECT_KEY}`);
  console.log('');

  // Iniciar multipart upload
  const create = await client.send(new CreateMultipartUploadCommand({
    Bucket: BUCKET,
    Key: OBJECT_KEY,
    ContentType: 'application/octet-stream',
  }));
  const uploadId = create.UploadId;
  console.log(`✅ Multipart upload iniciado: ${uploadId}`);

  const parts = [];

  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    const start = (partNumber - 1) * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize);
    const partSize = end - start;

    // Ler chunk do arquivo
    const buffer = await new Promise((resolve, reject) => {
      const chunks = [];
      const stream = createReadStream(FILE_PATH, { start, end: end - 1 });
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });

    const result = await client.send(new UploadPartCommand({
      Bucket: BUCKET,
      Key: OBJECT_KEY,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: buffer,
    }));

    parts.push({ PartNumber: partNumber, ETag: result.ETag });
    const percent = ((partNumber / totalParts) * 100).toFixed(0);
    console.log(`  ⬆️  Parte ${partNumber}/${totalParts} (${(partSize / 1024 / 1024).toFixed(1)}MB) — ${percent}%`);
  }

  // Finalizar upload
  await client.send(new CompleteMultipartUploadCommand({
    Bucket: BUCKET,
    Key: OBJECT_KEY,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  }));

  console.log('');
  console.log(`✅ Upload completo! Objeto disponível em: r2://${BUCKET}/${OBJECT_KEY}`);
  console.log(`🔗 Worker URL: https://beta-download-worker.script7sistemas.workers.dev/api/download/...`);
}

uploadMultipart().catch(err => {
  console.error('❌ Erro no upload:', err.message);
  process.exit(1);
});
