import { blobToDataUrl } from './fileVault';

export interface PdfExportOptions {
  filename: string;
  singlePageFit?: boolean;
  marginMm?: number;
  skipDownload?: boolean;
}

export interface PdfExportResult {
  blob: Blob;
  dataUrl: string;
  size: number;
  filename: string;
}

/**
 * Exports any HTML element into a real A4 PDF file (returning Blob + DataURL for database archiving)
 * and triggers browser download unless skipDownload=true.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  { filename, singlePageFit = true, marginMm = 0, skipDownload = false }: PdfExportOptions
): Promise<PdfExportResult> {
  // Ensure any embedded images (logos, QR codes) have decoded before rasterizing
  const imgs = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete) {
        return typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        setTimeout(done, 1500);
      });
    })
  );

  const isA4Paper = element.classList.contains('a4-paper');
  const captureWidth = isA4Paper ? 794 : Math.max(element.scrollWidth, element.clientWidth, 794);

  // Pustaka berat dimuat hanya saat PDF benar-benar dibuat
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: captureWidth,
    onclone: (_clonedDoc, clonedEl) => {
      clonedEl.style.zoom = '1';
      clonedEl.style.transform = 'none';
      clonedEl.style.boxShadow = 'none';
      clonedEl.style.margin = '0';
      if (isA4Paper) {
        clonedEl.style.width = '794px';
      }
      clonedEl.querySelectorAll('.no-print').forEach((node) => {
        if (node instanceof HTMLElement) {
          node.style.display = 'none';
        }
      });
    },
  });

  const imgData = canvas.toDataURL('image/png', 1.0);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const usableWidth = pageWidth - marginMm * 2;
  const usableHeight = pageHeight - marginMm * 2;
  const imgHeightMm = (canvas.height * usableWidth) / canvas.width;

  if (singlePageFit) {
    if (imgHeightMm <= usableHeight) {
      pdf.addImage(imgData, 'PNG', marginMm, marginMm, usableWidth, imgHeightMm, undefined, 'FAST');
    } else {
      const ratio = usableHeight / imgHeightMm;
      const fittedWidth = usableWidth * ratio;
      const offsetX = marginMm + (usableWidth - fittedWidth) / 2;
      pdf.addImage(imgData, 'PNG', offsetX, marginMm, fittedWidth, usableHeight, undefined, 'FAST');
    }
  } else {
    let heightLeft = imgHeightMm;
    let positionY = marginMm;

    pdf.addImage(imgData, 'PNG', marginMm, positionY, usableWidth, imgHeightMm, undefined, 'FAST');
    heightLeft -= usableHeight;

    while (heightLeft > 1) {
      positionY = marginMm - (imgHeightMm - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', marginMm, positionY, usableWidth, imgHeightMm, undefined, 'FAST');
      heightLeft -= usableHeight;
    }
  }

  const safeName = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  const blob = pdf.output('blob');
  const dataUrl = await blobToDataUrl(blob);

  if (!skipDownload) {
    pdf.save(safeName);
  }

  return {
    blob,
    dataUrl,
    size: blob.size,
    filename: safeName,
  };
}

/**
 * Attempts native window.print(). If blocked by an iframe sandbox (no beforeprint fired),
 * falls back automatically to generating & downloading the PDF file directly.
 * Also optionally captures a PDF binary for archiving even when native print succeeds.
 */
export async function printWithPdfFallback(options: {
  element: HTMLElement | null;
  filename: string;
  singlePageFit?: boolean;
  marginMm?: number;
  captureArchiveEvenIfPrinted?: boolean;
  prepareBeforePrint?: () => (() => void) | void;
  onFallbackToPdf?: () => void;
}): Promise<{ mode: 'printed' | 'downloaded'; pdf?: PdfExportResult }> {
  const {
    element,
    filename,
    singlePageFit = true,
    marginMm = 0,
    captureArchiveEvenIfPrinted = false,
    prepareBeforePrint,
    onFallbackToPdf,
  } = options;

  const cleanup = prepareBeforePrint?.();
  let printTriggered = false;

  const handleBeforePrint = () => {
    printTriggered = true;
  };
  const handleAfterPrint = () => {
    cleanup?.();
    window.removeEventListener('beforeprint', handleBeforePrint);
    window.removeEventListener('afterprint', handleAfterPrint);
  };

  window.addEventListener('beforeprint', handleBeforePrint);
  window.addEventListener('afterprint', handleAfterPrint);

  try {
    window.print();
  } catch {
    printTriggered = false;
  }

  await new Promise((resolve) => setTimeout(resolve, 180));

  if (printTriggered) {
    let pdf: PdfExportResult | undefined;
    if (captureArchiveEvenIfPrinted && element) {
      try {
        pdf = await exportElementToPdf(element, {
          filename,
          singlePageFit,
          marginMm,
          skipDownload: true,
        });
      } catch {
        // Ignore background capture error if print succeeded
      }
    }
    return { mode: 'printed', pdf };
  }

  window.removeEventListener('beforeprint', handleBeforePrint);
  window.removeEventListener('afterprint', handleAfterPrint);
  cleanup?.();

  let pdf: PdfExportResult | undefined;
  if (element) {
    onFallbackToPdf?.();
    pdf = await exportElementToPdf(element, { filename, singlePageFit, marginMm });
  }
  return { mode: 'downloaded', pdf };
}
