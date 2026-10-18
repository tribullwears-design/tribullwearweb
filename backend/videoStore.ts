import { randomUUID } from "node:crypto";
import type { Collection } from "mongodb";
import { getDatabase } from "./database.js";

export type VideoDocument = { id: string; title: string; url: string; thumbnail?: string; category?: string; isActive: boolean; createdAt: string; updatedAt: string };
async function getCollection(): Promise<Collection<VideoDocument>> { const collection = (await getDatabase()).collection<VideoDocument>("videos"); await collection.createIndex({ id: 1 }, { unique: true }); await collection.createIndex({ createdAt: -1 }); return collection; }
function validate(value: unknown): Omit<VideoDocument, "id" | "createdAt" | "updatedAt"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Video details are required");
  const input = value as Record<string, unknown>; const title = typeof input.title === "string" ? input.title.trim() : ""; const url = typeof input.url === "string" ? input.url.trim() : "";
  if (!title || title.length > 120) throw new Error("Video title is required and must be 120 characters or fewer");
  if ((!/^https:\/\//i.test(url) && !/^\/(?!\/)/.test(url)) || url.length > 2000 || (!/^https:\/\//i.test(url) && !/\.(mp4|webm|ogg)(\?|$)/i.test(url))) throw new Error("Video URL must be HTTPS or a supported video path");
  if (input.thumbnail !== undefined && typeof input.thumbnail !== "string") throw new Error("Thumbnail must be text");
  if (input.category !== undefined && typeof input.category !== "string") throw new Error("Category must be text");
  if (typeof input.isActive !== "boolean") throw new Error("Video active status must be specified");
  return { title, url, ...(input.thumbnail ? { thumbnail: String(input.thumbnail).slice(0, 2000) } : {}), ...(input.category ? { category: String(input.category).trim().slice(0, 80) } : {}), isActive: input.isActive };
}
export async function listVideos() { return (await getCollection()).find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray(); }
export async function listActiveVideos() { return (await getCollection()).find({ isActive: true }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray(); }
export async function createVideo(value: unknown) { const now = new Date().toISOString(); const video = { id: randomUUID(), ...validate(value), createdAt: now, updatedAt: now }; await (await getCollection()).insertOne(video); return video; }
export async function updateVideo(id: string, value: unknown) { if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error("Video identifier is invalid"); return (await getCollection()).findOneAndUpdate({ id }, { $set: { ...validate(value), updatedAt: new Date().toISOString() } }, { returnDocument: "after", projection: { _id: 0 } }); }
export async function deleteVideo(id: string) { if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error("Video identifier is invalid"); return (await (await getCollection()).deleteOne({ id })).deletedCount > 0; }
