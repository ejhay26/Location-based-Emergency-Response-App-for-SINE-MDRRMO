import { Directive, Input, ElementRef, OnChanges, SimpleChanges, Renderer2 } from '@angular/core';
import { ImageCacheService } from '../../core/services/image-cache';

/**
 * [videoThumbSrc] — generates a real preview frame for a video file and
 * sets it as an <img>'s src, instead of showing a static file icon.
 *
 * How it works: resolves the raw path to an authenticated blob: URL (same
 * fetch-with-ngrok-header pattern as ProxyImageDirective), loads it into an
 * off-screen <video>, seeks to a short offset into the clip, draws that
 * frame onto a canvas, and uses the canvas's data URL as the thumbnail.
 * Results are cached in memory per path so scrolling a list doesn't
 * regenerate the same thumbnail repeatedly.
 *
 * Usage: <img [videoThumbSrc]="rawVideoPath">
 */
@Directive({
  selector: '[videoThumbSrc]',
  standalone: true,
})
export class VideoThumbnailDirective implements OnChanges {
  @Input() videoThumbSrc: string | null | undefined;

  private static cache = new Map<string, string>();
  private requestToken = 0;

  constructor(
    private el: ElementRef<HTMLImageElement>,
    private renderer: Renderer2,
    private imageCache: ImageCacheService,
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (!('videoThumbSrc' in changes)) return;
    const path = this.videoThumbSrc;
    const token = ++this.requestToken;
    if (!path) return;

    const cached = VideoThumbnailDirective.cache.get(path);
    if (cached) {
      this.renderer.setAttribute(this.el.nativeElement, 'src', cached);
      return;
    }

    this.imageCache.resolve(path).then(blobUrl => {
      if (!blobUrl || token !== this.requestToken) return;
      this.generateThumbnail(blobUrl, path!, token);
    });
  }

  private generateThumbnail(videoBlobUrl: string, cacheKey: string, token: number) {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = videoBlobUrl;

    const capture = () => {
      if (token !== this.requestToken) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 160;
        canvas.height = video.videoHeight || 160;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        VideoThumbnailDirective.cache.set(cacheKey, dataUrl);
        if (token === this.requestToken) {
          this.renderer.setAttribute(this.el.nativeElement, 'src', dataUrl);
        }
      } catch {
        // Frame capture failed (e.g. codec not supported for canvas draw) —
        // leave the element without a thumbnail; caller falls back to icon.
      }
    };

    video.addEventListener('loadedmetadata', () => {
      // Seeking to 0 on some codecs returns a black frame — nudge slightly in.
      const seekTo = Math.min(0.3, (video.duration || 1) / 4);
      video.currentTime = seekTo;
    }, { once: true });

    video.addEventListener('seeked', capture, { once: true });
    video.addEventListener('error', () => { /* leave unset — fallback icon shows */ }, { once: true });
  }
}
