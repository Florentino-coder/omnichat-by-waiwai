import { decodeSlipQr } from "./slip-qr-decode.util";
import { Jimp } from "jimp";
import jsQR from "jsqr";

jest.mock("jimp", () => {
  return {
    __esModule: true,
    Jimp: {
      read: jest.fn(),
    },
  };
});
jest.mock("jsqr");

describe("decodeSlipQr Utility", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Case 1: Successful QR decode", async () => {
    ((Jimp as any).read as jest.Mock).mockResolvedValue({
      bitmap: {
        data: Buffer.from("rgba-data"),
        width: 100,
        height: 100,
      },
    });
    (jsQR as jest.Mock).mockReturnValue({
      data: "https://example.com/qr-code-data",
    });

    const result = await decodeSlipQr(Buffer.from("dummy-image"));
    expect(result).toEqual({
      status: "SUCCESS",
      rawData: "https://example.com/qr-code-data",
    });
  });

  it("Case 2: Image without QR", async () => {
    ((Jimp as any).read as jest.Mock).mockResolvedValue({
      bitmap: {
        data: Buffer.from("rgba-data"),
        width: 100,
        height: 100,
      },
    });
    (jsQR as jest.Mock).mockReturnValue(null);

    const result = await decodeSlipQr(Buffer.from("dummy-image"));
    expect(result).toEqual({
      status: "NOT_FOUND",
    });
  });

  it("Case 3: Failed to decode due to damaged QR", async () => {
    ((Jimp as any).read as jest.Mock).mockResolvedValue({
      bitmap: {
        data: Buffer.from("rgba-data"),
        width: 100,
        height: 100,
      },
    });
    (jsQR as jest.Mock).mockImplementation(() => {
      throw new Error("Decoding error");
    });

    const result = await decodeSlipQr(Buffer.from("dummy-image"));
    expect(result).toEqual({
      status: "FAILED",
    });
  });

  it("Case 4: Invalid image format (not an image)", async () => {
    ((Jimp as any).read as jest.Mock).mockRejectedValue(new Error("Invalid image format"));

    const result = await decodeSlipQr(Buffer.from("dummy-text-file"));
    expect(result).toEqual({
      status: "FAILED",
    });
  });

  it("Case 5: Empty image buffer", async () => {
    ((Jimp as any).read as jest.Mock).mockRejectedValue(new Error("Empty buffer"));

    const result = await decodeSlipQr(Buffer.from(""));
    expect(result).toEqual({
      status: "FAILED",
    });
  });

  it("Case 6: Non-slip image (e.g. portrait photo)", async () => {
    ((Jimp as any).read as jest.Mock).mockResolvedValue({
      bitmap: {
        data: Buffer.from("portrait-rgba-data"),
        width: 800,
        height: 600,
      },
    });
    (jsQR as jest.Mock).mockReturnValue(null);

    const result = await decodeSlipQr(Buffer.from("portrait-photo"));
    expect(result).toEqual({
      status: "NOT_FOUND",
    });
  });

  it("Case 7: Extremely small image size", async () => {
    ((Jimp as any).read as jest.Mock).mockResolvedValue({
      bitmap: {
        data: Buffer.from("rgba"),
        width: 1,
        height: 1,
      },
    });
    (jsQR as jest.Mock).mockReturnValue(null);

    const result = await decodeSlipQr(Buffer.from("tiny-pixel"));
    expect(result).toEqual({
      status: "NOT_FOUND",
    });
  });

  it("Case 8: Corrupted image parsing", async () => {
    ((Jimp as any).read as jest.Mock).mockImplementation(() => {
      throw new TypeError("Cannot read properties of undefined");
    });

    const result = await decodeSlipQr(Buffer.from("corrupted"));
    expect(result).toEqual({
      status: "FAILED",
    });
  });
});
