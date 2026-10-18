import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createIndex: vi.fn(), find: vi.fn(), getDatabase: vi.fn() }));
vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

import { listActiveVideos } from "./videoStore.js";

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
});
