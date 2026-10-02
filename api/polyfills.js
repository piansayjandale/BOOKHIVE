// Polyfill browser globals for Node.js serverless runtimes (Vercel, Render, etc.)
// Prevents "ReferenceError: DOMMatrix is not defined" when libraries like pdfjs-dist / pdf-parse load.
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a = 1;
      this.b = 0;
      this.c = 0;
      this.d = 1;
      this.e = 0;
      this.f = 0;
    }
  };
}
if (typeof globalThis.ImageData === "undefined") {
  globalThis.ImageData = class ImageData {};
}
if (typeof globalThis.Path2D === "undefined") {
  globalThis.Path2D = class Path2D {};
}

if (typeof global !== "undefined") {
  if (!global.DOMMatrix) global.DOMMatrix = globalThis.DOMMatrix;
  if (!global.ImageData) global.ImageData = globalThis.ImageData;
  if (!global.Path2D) global.Path2D = globalThis.Path2D;
}

