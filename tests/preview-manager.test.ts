import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyPreviewIdentity } from "../modules/radio/electron/preview-manager";

describe("host preview identity verification", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accepts a successful response only when it identifies Asteria", async () => {
    const request = vi.fn().mockResolvedValue(new Response("<html><title>Asteria — Preview</title></html>", { status: 200 }));
    vi.stubGlobal("fetch", request);
    await expect(verifyPreviewIdentity("http://127.0.0.1:4173", "<title>Asteria", 50)).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledOnce();
  });
});
