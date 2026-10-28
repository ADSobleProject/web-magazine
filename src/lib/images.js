// 이미지 업로드 저장소.
// - CLOUDINARY_URL이 있으면 Cloudinary에 올리고, 자동으로 작은 형식(webp 등)으로 제공되는 주소를 돌려준다.
// - 없으면 로컬 개발용으로 uploads 폴더에 저장한다. Render 무료 서버는 다시 켜질 때 파일이 지워지므로
//   운영(production)에서는 Cloudinary 없이 저장하지 않는다.
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// 파일 이름이나 브라우저가 알려 준 형식은 믿지 않고, 파일 앞부분의 실제 내용으로 판별한다.
// SVG는 안에 스크립트를 넣을 수 있어서 받지 않는다.
const SIGNATURES = [
  { ext: 'jpg', mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', mime: 'image/png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'gif', mime: 'image/gif', test: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8' },
  { ext: 'webp', mime: 'image/webp', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' }
];

export function detectImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  return SIGNATURES.find((s) => s.test(buffer)) || null;
}

export class StorageUnavailableError extends Error {}

const FORMAT_HINT = '형식: cloudinary://API_KEY:API_SECRET@CLOUD_NAME';

// 설정값 문제는 관리자에게 원인을 그대로 알려 준다(비밀값 자체는 보여 주지 않는다).
function parseCloudinaryUrl(value) {
  const trimmed = value.trim();
  if (/[<>]|your_api_(key|secret)/i.test(trimmed)) {
    throw new StorageUnavailableError('CLOUDINARY_URL에 예시 글자(<your_api_key>, <your_api_secret>)가 남아 있습니다. Cloudinary의 실제 API Key와 API Secret으로 바꿔 넣으세요.');
  }
  let u;
  try {
    u = new URL(trimmed.replace(/^CLOUDINARY_URL=/, ''));
  } catch {
    throw new StorageUnavailableError(`CLOUDINARY_URL 형식이 올바르지 않습니다. ${FORMAT_HINT}`);
  }
  if (u.protocol !== 'cloudinary:' || !u.username || !u.password || !u.hostname) {
    throw new StorageUnavailableError(`CLOUDINARY_URL 형식이 올바르지 않습니다. ${FORMAT_HINT}`);
  }
  return { cloud: u.hostname, key: decodeURIComponent(u.username), secret: decodeURIComponent(u.password) };
}

function unavailableStore(message) {
  return {
    kind: 'none',
    save() {
      throw new StorageUnavailableError(message);
    }
  };
}

function cloudinaryStore(config) {
  const { cloud, key, secret } = parseCloudinaryUrl(config);
  return {
    kind: 'cloudinary',
    async save(buffer, type) {
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = 'web-magazine';
      // 서명: 보낼 값들을 이름순으로 이어 붙이고 비밀값을 더해 SHA-1. 비밀값 자체는 보내지 않는다.
      const signature = createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest('hex');
      const form = new FormData();
      form.append('file', new Blob([buffer], { type: type.mime }));
      form.append('api_key', key);
      form.append('timestamp', String(timestamp));
      form.append('folder', folder);
      form.append('signature', signature);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        console.error(`Cloudinary 업로드 거절: ${res.status} ${data.error?.message || ''}`);
        throw new StorageUnavailableError('Cloudinary가 접속 정보를 거절했습니다. CLOUDINARY_URL의 API Key, API Secret, 클라우드 이름을 확인하세요.');
      }
      if (!res.ok || !data.public_id) throw new Error(`Cloudinary 업로드 실패: ${res.status} ${data.error?.message || ''}`);
      return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,c_limit,w_1600/v${data.version}/${data.public_id}`;
    }
  };
}

function localStore(dir) {
  return {
    kind: 'local',
    dir,
    async save(buffer, type) {
      await mkdir(dir, { recursive: true });
      const name = `${randomBytes(16).toString('hex')}.${type.ext}`;
      await writeFile(path.join(dir, name), buffer);
      return `/uploads/${name}`;
    }
  };
}

export function createImageStore({
  cloudinaryUrl = process.env.CLOUDINARY_URL,
  localDir,
  production = process.env.NODE_ENV === 'production'
} = {}) {
  if (cloudinaryUrl) {
    // 설정이 잘못돼도 서버는 켜고, 업로드할 때 원인을 알려 준다(사이트 전체가 멈추지 않게).
    try {
      return cloudinaryStore(cloudinaryUrl);
    } catch (err) {
      console.error(err.message);
      return unavailableStore(err.message);
    }
  }
  if (production) return unavailableStore('이미지 저장소(CLOUDINARY_URL)가 설정되지 않았습니다.');
  return localStore(localDir);
}
