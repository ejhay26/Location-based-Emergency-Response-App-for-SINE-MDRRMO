/**
 * Ultra HD Document Enhancement Pipeline (In-House Canvas 2D)
 *
 * Modeled after modern mobile Ultra HD Document scanners:
 * 1. Automatic Document Skew & Perspective Alignment:
 *    Detects angular card skew and straightens horizontal/vertical text lines.
 *
 * 2. Glare Suppression & Highlight Rolloff:
 *    Compresses high-luminance specular reflections (laminated cards & camera flash)
 *    using a smooth knee curve to recover washed-out ID text and details.
 *
 * 3. Adaptive Document Contrast Normalization:
 *    Stretches luminance percentiles across dynamic range to eliminate dim shadows
 *    and uneven background lighting.
 *
 * 4. Noise-Gated Typography Deblurring / Unsharp Mask:
 *    Selectively sharpens text strokes, PhilSys digits, and barcode edges without
 *    amplifying camera grain or causing artificial ringing artifacts.
 */

export interface EnhancementOptions {
  contrastClipLow?: number;   // default 0.02 (2% darkest pixels)
  contrastClipHigh?: number;  // default 0.98 (98% brightest pixels)
  glareThreshold?: number;    // luminance threshold above which glare is suppressed (default 215)
  glareRolloff?: number;      // rolloff factor for compressed highlights (default 0.45)
  sharpenStrength?: number;   // default 1.35 (gentle, natural definition)
  noiseGateThreshold?: number;// min contrast difference required before sharpening (default 6)
  jpegQuality?: number;       // default 0.92
}

export async function enhanceIdCardImage(
  dataUrl: string,
  options: EnhancementOptions = {}
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    return dataUrl;
  }

  const {
    contrastClipLow = 0.02,
    contrastClipHigh = 0.98,
    glareThreshold = 215,
    glareRolloff = 0.45,
    sharpenStrength = 1.35,
    noiseGateThreshold = 6,
    jpegQuality = 0.92,
  } = options;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const rawW = img.naturalWidth || img.width;
        const rawH = img.naturalHeight || img.height;

        if (rawW === 0 || rawH === 0) {
          resolve(dataUrl);
          return;
        }

        // ── Step 1: Detect Document Skew Angle ──
        const skewAngle = detectDocumentSkew(img, rawW, rawH);

        // ── Step 2: Render to Rectified Straightened Canvas ──
        const canvas = document.createElement('canvas');
        canvas.width = rawW;
        canvas.height = rawH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rawW, rawH);

        if (Math.abs(skewAngle) > 0.4 && Math.abs(skewAngle) <= 15) {
          ctx.save();
          ctx.translate(rawW / 2, rawH / 2);
          ctx.rotate((-skewAngle * Math.PI) / 180);
          ctx.drawImage(img, -rawW / 2, -rawH / 2, rawW, rawH);
          ctx.restore();
        } else {
          ctx.drawImage(img, 0, 0, rawW, rawH);
        }

        const imgData = ctx.getImageData(0, 0, rawW, rawH);
        const data = imgData.data;
        const totalPixels = rawW * rawH;

        // ── Step 3: Glare Suppression (Highlight Soft Rolloff) ──
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          if (lum > glareThreshold) {
            const compressedLum = glareThreshold + (lum - glareThreshold) * glareRolloff;
            const ratio = compressedLum / Math.max(1, lum);
            data[i] = Math.min(255, Math.round(r * ratio));
            data[i + 1] = Math.min(255, Math.round(g * ratio));
            data[i + 2] = Math.min(255, Math.round(b * ratio));
          }
        }

        // ── Step 4: Histogram Analysis & Contrast Normalization ──
        const histogram = new Uint32Array(256);
        for (let i = 0; i < data.length; i += 4) {
          const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          histogram[lum]++;
        }

        const lowCutoff = Math.floor(totalPixels * contrastClipLow);
        const highCutoff = Math.floor(totalPixels * contrastClipHigh);

        let cumulative = 0;
        let minLum = 0;
        let maxLum = 255;

        for (let i = 0; i < 256; i++) {
          cumulative += histogram[i];
          if (cumulative >= lowCutoff && minLum === 0) {
            minLum = i;
          }
          if (cumulative >= highCutoff) {
            maxLum = i;
            break;
          }
        }

        if (maxLum <= minLum) {
          maxLum = 255;
          minLum = 0;
        }

        const range = maxLum - minLum;
        const scale = 255 / range;

        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, Math.max(0, Math.round((data[i] - minLum) * scale)));
          data[i + 1] = Math.min(255, Math.max(0, Math.round((data[i + 1] - minLum) * scale)));
          data[i + 2] = Math.min(255, Math.max(0, Math.round((data[i + 2] - minLum) * scale)));
        }

        // ── Step 5: Noise-Gated Typography Deblurring / Unsharp Sharpening ──
        const outputImgData = ctx.createImageData(rawW, rawH);
        const outData = outputImgData.data;
        outData.set(data);

        const boost = sharpenStrength - 1.0; // edge boost amount (e.g. 0.35)

        for (let y = 1; y < rawH - 1; y++) {
          for (let x = 1; x < rawW - 1; x++) {
            const idx = (y * rawW + x) * 4;
            const up = ((y - 1) * rawW + x) * 4;
            const down = ((y + 1) * rawW + x) * 4;
            const left = (y * rawW + (x - 1)) * 4;
            const right = (y * rawW + (x + 1)) * 4;

            for (let c = 0; c < 3; c++) {
              const current = data[idx + c];
              const surroundAvg = (data[up + c] + data[down + c] + data[left + c] + data[right + c]) * 0.25;
              const diff = current - surroundAvg;

              // Only sharpen if contrast step exceeds noise floor
              if (Math.abs(diff) >= noiseGateThreshold) {
                outData[idx + c] = Math.min(255, Math.max(0, Math.round(current + diff * boost)));
              } else {
                outData[idx + c] = current;
              }
            }
            outData[idx + 3] = data[idx + 3];
          }
        }

        ctx.putImageData(outputImgData, 0, 0);
        const enhancedUrl = canvas.toDataURL('image/jpeg', jpegQuality);
        resolve(enhancedUrl);
      } catch {
        resolve(dataUrl);
      }
    };

    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Fast document skew detection using downsampled Sobel gradient projection.
 * Returns estimated tilt angle in degrees (-15 to +15).
 */
function detectDocumentSkew(img: HTMLImageElement, origW: number, origH: number): number {
  try {
    const sampleW = 160;
    const sampleH = Math.max(100, Math.round((sampleW * origH) / origW));

    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = sampleW;
    sampleCanvas.height = sampleH;
    const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!sCtx) return 0;

    sCtx.drawImage(img, 0, 0, sampleW, sampleH);
    const sData = sCtx.getImageData(0, 0, sampleW, sampleH).data;

    // Convert sample to grayscale buffer
    const gray = new Uint8Array(sampleW * sampleH);
    for (let i = 0, j = 0; i < sData.length; i += 4, j++) {
      gray[j] = Math.round(0.299 * sData[i] + 0.587 * sData[i + 1] + 0.114 * sData[i + 2]);
    }

    // Compute gradient angles across strong edge pixels
    let sumAngles = 0;
    let edgeCount = 0;

    for (let y = 4; y < sampleH - 4; y++) {
      for (let x = 4; x < sampleW - 4; x++) {
        const idx = y * sampleW + x;
        const gx = gray[idx + 1] - gray[idx - 1];
        const gy = gray[idx + sampleW] - gray[idx - sampleW];
        const mag = Math.hypot(gx, gy);

        if (mag > 45) {
          let deg = (Math.atan2(gy, gx) * 180) / Math.PI;
          // Map to near-horizontal/vertical line orientations
          while (deg < -45) deg += 90;
          while (deg > 45) deg -= 90;

          if (Math.abs(deg) <= 15) {
            sumAngles += deg;
            edgeCount++;
          }
        }
      }
    }

    if (edgeCount > 100) {
      const avg = sumAngles / edgeCount;
      return Math.round(avg * 10) / 10;
    }
  } catch {
    // Fall back to 0 on any canvas error
  }
  return 0;
}
