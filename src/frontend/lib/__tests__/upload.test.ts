import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadImage, UploadError } from "../upload";

// jsdom does not implement Blob.prototype.arrayBuffer — polyfill it so
// file.slice(0, 512).arrayBuffer() works in the test environment.
if (typeof Blob !== "undefined" && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

beforeEach(() => {
  global.fetch = vi.fn();
});

describe("UploadError", () => {
  it("is an instance of Error", () => {
    const err = new UploadError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(UploadError);
    expect(err.message).toBe("test");
  });
});

describe("uploadImage", () => {
  it("throws UploadError when file exceeds 10 MB", async () => {
    const bigFile = new File(
      [new Uint8Array(10 * 1024 * 1024 + 1)],
      "big.jpg",
      { type: "image/jpeg" }
    );
    const promise = uploadImage(bigFile);
    await expect(promise).rejects.toBeInstanceOf(UploadError);
    await expect(promise).rejects.toThrow(/troppo grande/);
  });

  it("throws UploadError with detail when SAS fetch returns ok: false", async () => {
    const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: "Tipo non consentito" }),
    });
    const promise = uploadImage(file);
    await expect(promise).rejects.toBeInstanceOf(UploadError);
    await expect(promise).rejects.toThrow("Tipo non consentito");
  });

  it("throws UploadError with fallback message when SAS fetch returns ok: false with no detail", async () => {
    const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    const promise = uploadImage(file);
    await expect(promise).rejects.toBeInstanceOf(UploadError);
    await expect(promise).rejects.toThrow("Tipo file non supportato.");
  });

  it("throws UploadError with fallback when SAS fetch returns ok: false and json() rejects", async () => {
    const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => { throw new Error("not json"); },
    });
    const promise = uploadImage(file);
    await expect(promise).rejects.toBeInstanceOf(UploadError);
    await expect(promise).rejects.toThrow("Tipo file non supportato.");
  });

  it("throws UploadError when blob PUT returns ok: false", async () => {
    const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sas_url: "https://blob.example.com/upload?sas=token",
          blob_url: "https://blob.example.com/images/test.jpg",
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
      });
    const promise = uploadImage(file);
    await expect(promise).rejects.toBeInstanceOf(UploadError);
    await expect(promise).rejects.toThrow(
      "Errore nel caricamento dell'immagine su Azure."
    );
  });

  it("returns blob_url on happy path", async () => {
    const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
    const expectedUrl = "https://blob.example.com/images/test.jpg";
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sas_url: "https://blob.example.com/upload?sas=token",
          blob_url: expectedUrl,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
      });
    const result = await uploadImage(file);
    expect(result).toBe(expectedUrl);
  });

  it("sends the correct request to the SAS endpoint", async () => {
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sas_url: "https://blob.example.com/upload?sas=token",
          blob_url: "https://blob.example.com/images/photo.jpg",
        }),
      })
      .mockResolvedValueOnce({ ok: true });

    await uploadImage(file);

    const [sasUrl, sasOptions] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(sasUrl).toBe("/api/admin/media/sas");
    expect(sasOptions.method).toBe("POST");
    expect(sasOptions.credentials).toBe("include");
    const body = JSON.parse(sasOptions.body as string);
    expect(body.filename).toBe("photo.jpg");
    expect(body.size).toBe(file.size);
  });

  it("sends the correct PUT request to the blob SAS URL", async () => {
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    const sasUrl = "https://blob.example.com/upload?sas=token";
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sas_url: sasUrl,
          blob_url: "https://blob.example.com/images/photo.jpg",
        }),
      })
      .mockResolvedValueOnce({ ok: true });

    await uploadImage(file);

    const [blobUrl, blobOptions] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(blobUrl).toBe(sasUrl);
    expect(blobOptions.method).toBe("PUT");
    expect(blobOptions.headers["x-ms-blob-type"]).toBe("BlockBlob");
    expect(blobOptions.headers["Content-Type"]).toBe("image/jpeg");
    expect(blobOptions.body).toBe(file);
  });
});
