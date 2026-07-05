import { Jimp } from "jimp";
import jsQR from "jsqr";

export interface QrDecodeResult {
  status: "SUCCESS" | "FAILED" | "NOT_FOUND";
  rawData?: string;
}

export async function decodeSlipQr(imageBuffer: Buffer): Promise<QrDecodeResult> {
  try {
    const image = await Jimp.read(imageBuffer);
    const { data, width, height } = image.bitmap;

    const clampedData = new Uint8ClampedArray(data);
    const code = jsQR(clampedData, width, height);

    if (!code) {
      return { status: "NOT_FOUND" };
    }

    return {
      status: "SUCCESS",
      rawData: code.data,
    };
  } catch (err) {
    return { status: "FAILED" };
  }
}
