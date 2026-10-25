import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createIndex: vi.fn(),
  find: vi.fn(),
  getDatabase: vi.fn(),
  collection: vi.fn(),
  updateOne: vi.fn(),
  insertOne: vi.fn(),
  deleteMany: vi.fn(),
  bucketDelete: vi.fn(),
  gridFsBucket: vi.fn(),
  existing: [] as { id: string; title: string; storageId?: string; createdAt?: string; thumbnail?: string; category?: string }[],
  operations: [] as string[],
}));
vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("mongodb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mongodb")>();
  return { ...actual, GridFSBucket: mocks.gridFsBucket };
});

import { ObjectId } from "mongodb";
import { createUploadedVideo, listActiveVideos, MAX_VIDEO_UPLOAD_BYTES, parseVideoByteRange, validateVideoUpload } from "./videoStore.js";

describe("homepage videos", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.existing = [];
    mocks.operations = [];
    mocks.find.mockReturnValue({ sort: () => ({ toArray: async () => [] }) });
    mocks.collection.mockReturnValue({
      createIndex: mocks.createIndex,
      find: mocks.find,
      updateOne: mocks.updateOne,
      insertOne: mocks.insertOne,
      deleteMany: mocks.deleteMany,
    });
    mocks.getDatabase.mockResolvedValue({ collection: mocks.collection });
    mocks.gridFsBucket.mockImplementation(() => ({
      openUploadStream: () => {
        const handlers: Record<string, () => void> = {};
        return {
          id: new ObjectId(),
          once: (event: string, callback: () => void) => { handlers[event] = callback; },
          end: () => { handlers.finish?.(); },
        };
      },
      delete: async (id: ObjectId) => {
        mocks.operations.push(`delete:${id.toHexString()}`);
        await mocks.bucketDelete(id);
      },
    }));
  });

  it("loads only active saved videos from the videos collection", async () => {
    const toArray = vi.fn().mockResolvedValue([{ id: "video-1", title: "Saved video", url: "https://cdn.example/video.mp4", isActive: true }]);
    const sort = vi.fn().mockReturnValue({ toArray });
    mocks.find.mockReturnValue({ sort });

    await expect(listActiveVideos()).resolves.toMatchObject([{ id: "video-1", isActive: true }]);
    expect(mocks.find).toHaveBeenCalledWith({ isActive: true }, { projection: { _id: 0 } });
  });

  it("accepts supported upload types and rejects unsupported or oversized files", () => {
    expect(validateVideoUpload({ mimeType: "video/mp4", size: 1024 })).toBe("video/mp4");
    expect(validateVideoUpload({ mimeType: "video/webm", size: MAX_VIDEO_UPLOAD_BYTES })).toBe("video/webm");
    expect(() => validateVideoUpload({ mimeType: "image/png", size: 1024 })).toThrow("MP4, WebM, or OGG");
    expect(() => validateVideoUpload({ mimeType: "video/mp4", size: MAX_VIDEO_UPLOAD_BYTES + 1 })).toThrow("100 MB");
  });

  it("parses standard, open-ended, and suffix video byte ranges", () => {
    expect(parseVideoByteRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(parseVideoByteRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
    expect(parseVideoByteRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseVideoByteRange("bytes=90-200", 100)).toEqual({ start: 90, end: 99 });
    expect(parseVideoByteRange(undefined, 100)).toBeNull();
  });

  it("marks unsatisfiable video byte ranges", () => {
    expect(parseVideoByteRange("bytes=100-", 100)).toEqual({ unsatisfiable: true });
    expect(parseVideoByteRange("bytes=20-10", 100)).toEqual({ unsatisfiable: true });
    expect(parseVideoByteRange("bytes=-0", 100)).toEqual({ unsatisfiable: true });
  });

  it("replaces a case-insensitive same-title video and removes its old GridFS file", async () => {
    const oldStorageId = new ObjectId().toHexString();
    mocks.existing = [{ id: "video-1", title: "Summer", storageId: oldStorageId, createdAt: "2026-01-01T00:00:00.000Z" }];
    mocks.find.mockReturnValue({
      collation: (options: unknown) => {
        expect(options).toEqual({ locale: "en", strength: 2 });
        return { toArray: async () => mocks.existing };
      },
    });
    mocks.updateOne.mockImplementation(async () => {
      mocks.operations.push("update");
      return { matchedCount: 1 };
    });

    const result = await createUploadedVideo(" summer ", Buffer.from("new video"), "video/mp4");

    expect(result).toMatchObject({ replaced: true, video: { id: "video-1", title: "summer" } });
    expect(mocks.updateOne).toHaveBeenCalledWith({ id: "video-1" }, { $set: expect.objectContaining({ storageId: expect.any(String) }) });
    expect(mocks.operations).toEqual(["update", `delete:${oldStorageId}`]);
  });

  it("adds a new record when the title does not match an existing video", async () => {
    mocks.find.mockReturnValue({ collation: () => ({ toArray: async () => [] }) });

    await expect(createUploadedVideo("A new video", Buffer.from("video"), "video/webm"))
      .resolves.toMatchObject({ replaced: false, video: { title: "A new video" } });
    expect(mocks.insertOne).toHaveBeenCalledWith(expect.objectContaining({ title: "A new video" }));
    expect(mocks.updateOne).not.toHaveBeenCalled();
    expect(mocks.bucketDelete).not.toHaveBeenCalled();
  });

  it("keeps the old video file when replacing its collection record fails", async () => {
    const oldStorageId = new ObjectId().toHexString();
    mocks.existing = [{ id: "video-1", title: "Summer", storageId: oldStorageId }];
    mocks.find.mockReturnValue({ collation: () => ({ toArray: async () => mocks.existing }) });
    mocks.updateOne.mockResolvedValue({ matchedCount: 0 });

    await expect(createUploadedVideo("Summer", Buffer.from("new video"), "video/mp4"))
      .rejects.toThrow("The existing video changed during upload");
    expect(mocks.bucketDelete).toHaveBeenCalledTimes(1);
    expect(mocks.bucketDelete).toHaveBeenCalledWith(expect.objectContaining({ _bsontype: "ObjectId" }));
    expect(mocks.bucketDelete.mock.calls[0]?.[0].toHexString()).not.toBe(oldStorageId);
  });

  it("reports failure to delete an old GridFS file after saving the replacement", async () => {
    const oldStorageId = new ObjectId().toHexString();
    mocks.existing = [{ id: "video-1", title: "Summer", storageId: oldStorageId }];
    mocks.find.mockReturnValue({ collation: () => ({ toArray: async () => mocks.existing }) });
    mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
    mocks.bucketDelete.mockRejectedValue(new Error("GridFS unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(createUploadedVideo("Summer", Buffer.from("new video"), "video/mp4"))
      .resolves.toMatchObject({ replaced: true, cleanupWarning: expect.any(String) });
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("Could not remove the replaced video file"), expect.any(Error));
    consoleError.mockRestore();
  });
});
