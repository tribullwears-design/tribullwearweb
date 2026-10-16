import { describe, expect, it } from "vitest";
import { getAdminProductLoadError } from "./adminProductError";

describe("admin product load errors", () => {
  it("explains missing or expired admin sessions for 401 responses", () => {
    expect(getAdminProductLoadError(401)).toMatch(/session has expired or is missing/i);
  });

  it("explains missing product permissions for 403 responses", () => {
    expect(getAdminProductLoadError(403)).toMatch(/permission to view products/i);
  });

  it("keeps API and database failures distinct from authorization failures", () => {
    expect(getAdminProductLoadError(500)).toMatch(/API or database error/i);
    expect(getAdminProductLoadError()).toMatch(/API or database error/i);
  });
});
