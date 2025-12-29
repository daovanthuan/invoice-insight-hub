import * as pdfjsLib from "pdfjs-dist";

// Vite will bundle the worker and give us its URL.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export async function renderPdfFirstPageToPngBase64(pdfFile: File): Promise<string> {
  const data = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  if (!canvas.getContext("2d")) throw new Error("Canvas not supported");

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  // In pdfjs v5, `canvas` is the preferred render target.
  await page.render({ canvas, viewport }).promise;

  const dataUrl = canvas.toDataURL("image/png");
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("Failed to convert PDF page to image");
  return base64;
}
