import { BrowserMultiFormatReader, Result } from "@zxing/browser";

const reader = new BrowserMultiFormatReader();

export async function startScanner(
  videoElement: HTMLVideoElement,
  onResult: (code: string) => void,
  onError?: (error: unknown) => void,
  deviceId?: string
) {
  try {
    await reader.decodeFromVideoDevice(deviceId, videoElement, (result: Result | undefined, err) => {
      if (result) onResult(result.getText());
      if (err && onError) onError(err);
    });
  } catch (error) {
    if (onError) onError(error);
    console.warn("Barcode scanner failed to start", error);
  }
}

export function stopScanner() {
  reader.reset();
}

export async function scanBarcode(imageUrl: string): Promise<string | null> {
  try {
    const result = await reader.decodeFromImageUrl(imageUrl);
    return result?.getText() || null;
  } catch (error) {
    console.warn("Failed to decode barcode", error);
    return null;
  }
}
