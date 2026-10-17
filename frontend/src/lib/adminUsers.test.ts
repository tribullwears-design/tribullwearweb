import { describe, expect, it, vi } from "vitest";
import { saveAdminUserAndRefresh } from "./adminUsers.js";

describe("saveAdminUserAndRefresh", () => {
  it("refreshes the Admin Users list after a confirmed grant", async () => {
    const saved = { id: "admin-1", role: "Manager" };
    const save = vi.fn().mockResolvedValue(saved);
    const refresh = vi.fn().mockResolvedValue(undefined);
    await expect(saveAdminUserAndRefresh(save, refresh)).resolves.toEqual(saved);
    expect(save).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does not refresh or report success when the server rejects a grant", async () => {
    const save = vi.fn().mockRejectedValue(new Error("Forbidden"));
    const refresh = vi.fn();
    await expect(saveAdminUserAndRefresh(save, refresh)).rejects.toThrow("Forbidden");
    expect(refresh).not.toHaveBeenCalled();
  });
});
