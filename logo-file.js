// A LOGO FILE TO A PICTURE (Movie, 25 Oct: "can we allow PDF and as many
// other image filetypes as possilbe for the LOGO. any that aren't really hard
// ones or will mess stuff up" -- and, from the list he was shown, "do all the
// check marks not the illistrator").
//
// PNG, JPEG, GIF (its first frame), WEBP, SVG, BMP, ICO and AVIF the browser
// decodes itself. A PDF is its FIRST PAGE, rendered through the pdf.js this
// app already ships for underlays (vendor/, fetched only when a PDF is
// picked). TIFF, HEIC, EPS, PSD and CDR are not offered: a browser cannot
// read them without a large decoder or a server.
//
// Shared by COMPANY STANDARDS (which crops next) and Construction Layout's
// logo picker (which trims the margin), so the two upload doors take the
// same files and turn them into the same picture.
(() => {
  const TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
    'image/bmp', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/avif', 'application/pdf'];
  const EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif', '.pdf'];
  // What a file input's `accept` names: the types AND the extensions, because
  // an operating system that does not know a type (.avif, .ico on some) still
  // offers the file by its name.
  const ACCEPT = [...TYPES, ...EXTENSIONS].join(',');

  const isPdf = file => file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');

  let pdfJsLoading = null;
  const ensurePdfJs = () => {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfJsLoading) {
      pdfJsLoading = new Promise((resolve, reject) => {
        const tag = document.createElement('script');
        tag.src = './vendor/pdf-3.11.174.min.js';
        tag.onload = () => {
          if (!window.pdfjsLib) { reject(new Error('The PDF reader did not start.')); return; }
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf-3.11.174.worker.min.js';
          resolve(window.pdfjsLib);
        };
        tag.onerror = () => reject(new Error('The PDF reader could not be fetched.'));
        document.head.appendChild(tag);
      }).catch(error => { pdfJsLoading = null; throw error; });
    }
    return pdfJsLoading;
  };

  // Down to `maxPx` on the long side, never up.
  const fitted = (source, iw, ih, maxPx) => {
    const k = Math.min(1, maxPx / Math.max(iw, ih));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(iw * k));
    canvas.height = Math.max(1, Math.round(ih * k));
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  const fromPdf = async (file, maxPx) => {
    const pdfjs = await ensurePdfJs();
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    try {
      const page = await doc.getPage(1);
      const one = page.getViewport({ scale: 1 });
      // Rendered at twice the size it is kept at, then brought down: thin
      // letterforms survive the shrink better than a render made small.
      const viewport = page.getViewport({ scale: (maxPx * 2) / Math.max(one.width, one.height) });
      const big = document.createElement('canvas');
      big.width = Math.round(viewport.width);
      big.height = Math.round(viewport.height);
      await page.render({ canvasContext: big.getContext('2d'), viewport }).promise;
      return fitted(big, big.width, big.height, maxPx);
    } catch {
      throw new Error('That PDF could not be read.');
    } finally {
      doc.destroy().catch(() => {});
    }
  };

  const fromImage = (file, maxPx) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not an image this browser can read.')); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      // AN SVG WITH NO INTRINSIC SIZE decodes to 0x0 in some browsers; 300px
      // square is what the spec says to assume.
      resolve(fitted(img, img.naturalWidth || img.width || 300, img.naturalHeight || img.height || 300, maxPx));
    };
    img.src = url;
  });

  const toCanvas = (file, maxPx = 512) => (isPdf(file) ? fromPdf(file, maxPx) : fromImage(file, maxPx));

  window.DraftLogoFile = Object.freeze({ ACCEPT, TYPES, EXTENSIONS, isPdf, toCanvas });
})();
