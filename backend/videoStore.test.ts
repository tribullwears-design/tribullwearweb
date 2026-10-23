import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createIndex: vi.fn(), find: vi.fn(), getDatabase: vi.fn() }));
vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

import { listActiveVideos, MAX_VIDEO_UPLOAD_BYTES, parseVideoByteRange, validateVideoUpload } from "./videoStore.js";

describe("homepage videos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDatabase.mockResolvedValue({ collection: () => ({ createIndex: mocks.createIndex, find: mocks.find }) });
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
});
