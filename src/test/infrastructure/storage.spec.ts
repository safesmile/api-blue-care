import { ConfigService } from "@nestjs/config";
import { GcsFileStorage } from "../../infrastructure/storage/gcs-file-storage";
const save = jest.fn(),
  getSignedUrl = jest.fn(),
  remove = jest.fn(),
  bucket = jest.fn(),
  file = jest.fn();
jest.mock("@google-cloud/storage", () => ({
  Storage: jest.fn().mockImplementation(() => ({ bucket: (...a) => bucket(...a) }))
}));
describe("Private GCS storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bucket.mockReturnValue({ file });
    file.mockReturnValue({ save, getSignedUrl, delete: remove });
    getSignedUrl.mockResolvedValue(["https://signed.example/object"]);
  });
  it("uploads to a private generated key, signs bounded links and deletes idempotently", async () => {
    const storage = new GcsFileStorage(new ConfigService({ GCS_PRIVATE_BUCKET: "blue-private" }));
    const key = await storage.upload(Buffer.from("example"), "application/pdf");
    expect(key).toMatch(/^blue-dent\/[0-9a-f-]{36}$/);
    expect(save).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ preconditionOpts: { ifGenerationMatch: 0 } })
    );
    expect(await storage.signedReadUrl(key)).toBe("https://signed.example/object");
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({ version: "v4", action: "read", expires: expect.any(Number) })
    );
    await storage.delete(key);
    expect(remove).toHaveBeenCalledWith({ ignoreNotFound: true });
  });
  it("rejects foreign keys, unsupported uploads and absent configuration", async () => {
    const storage = new GcsFileStorage(new ConfigService({}));
    await expect(storage.signedReadUrl("../other")).rejects.toThrow("La clave del archivo no es válida");
    await expect(storage.upload(Buffer.from("bad"), "text/html")).rejects.toThrow("El archivo no está permitido");
    await expect(storage.upload(Buffer.alloc(10 * 1024 * 1024 + 1), "application/pdf")).rejects.toThrow("límite");
    await expect(storage.upload(Buffer.from("example"), "application/pdf")).rejects.toThrow("no está configurado");
  });
});
