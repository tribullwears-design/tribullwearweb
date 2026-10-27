import { randomUUID } from "node:crypto";
import { ObjectId, GridFSBucket, type Collection } from "mongodb";
import { getDatabase } from "./database.js";

export const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;
const supportedVideoTypes = new Set(["video/mp4", "video/webm", "video/ogg"]);
type VideoFileMetadata = { length: number; mimeType: string };
const videoFileMetadataCache = new Map<string, VideoFileMetadata>();
export type VideoDocument = { id: string; title: string; url: string; storageId?: string; mimeType?: string; thumbnail?: string; category?: string; isActive: boolean; createdAt: string; updatedAt: string };
export type UploadedVideoResult = { video: VideoDocument; replaced: boolean; cleanupWarning?: string };
type VideoByteRange = { start: number; end: number } | { unsatisfiable: true } | null;

export function parseVideoByteRange(header: string | undefined, length: number): VideoByteRange {
  if (!header || !header.startsWith("bytes=") || header.includes(",")) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2]) || length <= 0) return { unsatisfiable: true };

  const requestedStart = match[1] ? Number(match[1]) : null;
  const requestedEnd = match[2] ? Number(match[2]) : null;
  if ((requestedStart !== null && !Number.isSafeInteger(requestedStart)) || (requestedEnd !== null && !Number.isSafeInteger(requestedEnd))) {
    return { unsatisfiable: true };
  }

  if (requestedStart === null) {
    if (!requestedEnd) return { unsatisfiable: true };
    return { start: Math.max(0, length - requestedEnd), end: length - 1 };
  }
  if (requestedStart >= length || (requestedEnd !== null && requestedEnd < requestedStart)) return { unsatisfiable: true };
  return { start: requestedStart, end: Math.min(requestedEnd ?? length - 1, length - 1) };
}

async function getCollection(): Promise<Collection<VideoDocument>> { const collection = (await getDatabase()).collection<VideoDocument>("videos"); await collection.createIndex({ id: 1 }, { unique: true }); await collection.createIndex({ createdAt: -1 }); return collection; }
function validateTitle(value: unknown) {
  const title = typeof value === "string" ? value.trim() : "";
  if (!title || title.length > 120) throw new Error("Video name is required and must be 120 characters or fewer");
  return title;
}
export function validateVideoUpload(file: { mimeType: unknown; size: unknown }) {
  if (typeof file.mimeType !== "string" || !supportedVideoTypes.has(file.mimeType.toLowerCase())) throw new Error("Upload an MP4, WebM, or OGG video");
  if (typeof file.size !== "number" || !Number.isInteger(file.size) || file.size < 1 || file.size > MAX_VIDEO_UPLOAD_BYTES) throw new Error("Video must be smaller than 100 MB");
  return file.mimeType.toLowerCase();
}
function fileObjectId(value: string) {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}
function cacheVideoFileMetadata(storageId: string, metadata: VideoFileMetadata) {
  videoFileMetadataCache.delete(storageId);
  videoFileMetadataCache.set(storageId, metadata);
  if (videoFileMetadataCache.size > 32) {
    const oldestStorageId = videoFileMetadataCache.keys().next().value;
    if (oldestStorageId) videoFileMetadataCache.delete(oldestStorageId);
  }
}
async function getBucket() { return new GridFSBucket(await getDatabase(), { bucketName: "video-files" }); }
function validate(value: unknown): Omit<VideoDocument, "id" | "createdAt" | "updatedAt"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Video details are required");
  const input = value as Record<string, unknown>; const title = validateTitle(input.title); const url = typeof input.url === "string" ? input.url.trim() : "";
  if ((!/^https:\/\//i.test(url) && !/^\/(?!\/)/.test(url)) || url.length > 2000 || (!/^https:\/\//i.test(url) && !/\.(mp4|webm|ogg)(\?|$)/i.test(url))) throw new Error("Video URL must be HTTPS or a supported video path");
  if (input.thumbnail !== undefined && typeof input.thumbnail !== "string") throw new Error("Thumbnail must be text");
  if (input.category !== undefined && typeof input.category !== "string") throw new Error("Category must be text");
  if (typeof input.isActive !== "boolean") throw new Error("Video active status must be specified");
  return { title, url, ...(input.thumbnail ? { thumbnail: String(input.thumbnail).slice(0, 2000) } : {}), ...(input.category ? { category: String(input.category).trim().slice(0, 80) } : {}), isActive: input.isActive };
}
export async function listVideos() { return (await getCollection()).find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray(); }
export async function listActiveVideos() { return (await getCollection()).find({ isActive: true }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray(); }
export async function createVideo(value: unknown) { const now = new Date().toISOString(); const video = { id: randomUUID(), ...validate(value), createdAt: now, updatedAt: now }; await (await getCollection()).insertOne(video); return video; }
export async function createUploadedVideo(title: unknown, bytes: Buffer, mimeType: unknown) {
  const safeTitle = validateTitle(title);
  const safeMimeType = validateVideoUpload({ mimeType, size: bytes.length });
  const bucket = await getBucket();
  const collection = await getCollection();
  const existing = await collection.find({ title: safeTitle }).collation({ locale: "en", strength: 2 }).toArray();
  const current = existing[0];
  const upload = bucket.openUploadStream(`${randomUUID()}.video`, { metadata: { mimeType: safeMimeType } });
  const fileId = upload.id as ObjectId;
  const video: VideoDocument = {
    id: current?.id || randomUUID(),
    title: safeTitle,
    url: `/api/videos/files/${fileId.toHexString()}`,
    storageId: fileId.toHexString(),
    mimeType: safeMimeType,
    ...(current?.thumbnail ? { thumbnail: current.thumbnail } : {}),
    ...(current?.category ? { category: current.category } : {}),
    isActive: true,
    createdAt: current?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  try {
    await new Promise<void>((resolve, reject) => {
      upload.once("finish", resolve);
      upload.once("error", reject);
      upload.end(bytes);
    });
  } catch (error) {
    try {
      await bucket.delete(fileId);
    } catch (cleanupError) {
      console.error("Could not remove the incomplete uploaded video file.", cleanupError);
    }
    throw error;
  }
  try {
    if (current) {
      const update = await collection.updateOne({ id: current.id }, { $set: video });
      if (!update.matchedCount) throw new Error("The existing video changed during upload. Please upload it again.");
    } else {
      await collection.insertOne(video);
    }
  } catch (error) {
    videoFileMetadataCache.delete(fileId.toHexString());
    try {
      await bucket.delete(fileId);
    } catch (cleanupError) {
      console.error("Could not remove the uploaded video after its collection update failed.", cleanupError);
    }
    throw error;
  }
  cacheVideoFileMetadata(fileId.toHexString(), { length: bytes.length, mimeType: safeMimeType });

  let duplicateRecordsRemoved = true;
  if (current && existing.length > 1) {
    try {
      await collection.deleteMany(
        { title: safeTitle, id: { $ne: current.id } },
        { collation: { locale: "en", strength: 2 } },
      );
    } catch (error) {
      duplicateRecordsRemoved = false;
      console.error(`Could not remove duplicate video records for "${safeTitle}".`, error);
    }
  }

  const oldVideos = current ? existing.filter((oldVideo) => oldVideo.id === current.id || duplicateRecordsRemoved) : [];
  const cleanupFailures: string[] = [];
  for (const oldVideo of oldVideos) {
    if (!oldVideo.storageId || oldVideo.storageId === video.storageId) continue;
    const oldFileId = fileObjectId(oldVideo.storageId);
    if (!oldFileId) continue;
    videoFileMetadataCache.delete(oldVideo.storageId);
    try {
      await bucket.delete(oldFileId);
    } catch (error) {
      console.error(`Could not remove the replaced video file for "${safeTitle}".`, error);
      cleanupFailures.push(oldVideo.storageId);
    }
  }

  return {
    video,
    replaced: Boolean(current),
    ...(cleanupFailures.length || !duplicateRecordsRemoved ? {
      cleanupWarning: "The new video was saved, but one or more old video files or duplicate records could not be deleted.",
    } : {}),
  };
}
export async function updateVideo(id: string, value: unknown) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error("Video identifier is invalid");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Video details are required");
  const input = value as Record<string, unknown>;
  const updates: Partial<VideoDocument> = { title: validateTitle(input.title), updatedAt: new Date().toISOString() };
  if (Object.prototype.hasOwnProperty.call(input, "url") || Object.prototype.hasOwnProperty.call(input, "isActive") || Object.prototype.hasOwnProperty.call(input, "thumbnail") || Object.prototype.hasOwnProperty.call(input, "category")) {
    Object.assign(updates, validate(value));
  }
  return (await getCollection()).findOneAndUpdate({ id }, { $set: updates }, { returnDocument: "after", projection: { _id: 0 } });
}
export async function deleteVideo(id: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error("Video identifier is invalid");
  const collection = await getCollection();
  const video = await collection.findOne({ id });
  if (!video) return false;
  if (video.storageId) {
    videoFileMetadataCache.delete(video.storageId);
    const objectId = fileObjectId(video.storageId);
    if (objectId) await (await getBucket()).delete(objectId).catch(() => undefined);
  }
  await collection.deleteOne({ id });
  return true;
}
export async function streamVideoFile(storageId: string, res: import("express").Response, rangeHeader?: string) {
  const objectId = fileObjectId(storageId);
  if (!objectId) return false;
  const bucket = await getBucket();
  let fileMetadata = videoFileMetadataCache.get(storageId);
  if (!fileMetadata) {
    const files = await bucket.find({ _id: objectId }).toArray();
    const file = files[0];
    if (!file) return false;
    const metadata = file.metadata as { mimeType?: string } | undefined;
    fileMetadata = { length: file.length, mimeType: metadata?.mimeType || "application/octet-stream" };
    cacheVideoFileMetadata(storageId, fileMetadata);
  }
  const range = parseVideoByteRange(rangeHeader, fileMetadata.length);
  res.setHeader("Content-Type", fileMetadata.mimeType);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

  if (range && "unsatisfiable" in range) {
    res.setHeader("Content-Range", `bytes */${fileMetadata.length}`);
    res.status(416).end();
    return true;
  }

  if (range) {
    res.status(206);
    res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${fileMetadata.length}`);
    res.setHeader("Content-Length", String(range.end - range.start + 1));
    bucket.openDownloadStream(objectId, { start: range.start, end: range.end + 1 }).pipe(res);
    return true;
  }

  res.setHeader("Content-Length", String(fileMetadata.length));
  bucket.openDownloadStream(objectId).pipe(res);
  return true;
}
