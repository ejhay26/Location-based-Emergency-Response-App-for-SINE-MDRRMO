import { Directive, Input, ElementRef, OnChanges, SimpleChanges, Renderer2 } from '@angular/core';
import { ImageCacheService } from '../../core/services/image-cache';

/**
 * [proxySrc] — drop-in replacement for [src] on <img>/<video> elements that
 * load from the backend's storage-proxy.
 *
 * Plain <img [src]="path"> can't attach the 'ngrok-skip-browser-warning'
 * header, so ngrok serves its HTML interstitial instead of the file, and the
 * browser's Cross-Origin Read Blocking (CORB) then silently drops it —
 * broken thumbnails, no console error beyond a CORB warning.
 *
 * This directive routes the load through ImageCacheService, which does a
 * real fetch() with the required header and converts the response to a
 * blob: URL before handing it to the element — the same approach already
 * used successfully by the citizen app's profile/report pages.
 *
 * Usage: <img [proxySrc]="rawStoragePath">  — pass the RAW path/URL from
 * the API response, not a pre-built proxy URL; the service builds that
 * internally.
 */
@Directive({
  selector: '[proxySrc]',
  standalone: true,
})
export class ProxyImageDirective implements OnChanges {
  @Input() proxySrc: string | null | undefined;

  private requestToken = 0;

  constructor(
    private el: ElementRef<HTMLImageElement | HTMLVideoElement>,
    private renderer: Renderer2,
    private imageCache: ImageCacheService,
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (!('proxySrc' in changes)) return;
    const path = this.proxySrc;
    const token = ++this.requestToken; // guards against out-of-order async resolves

    if (!path) {
      this.renderer.setAttribute(this.el.nativeElement, 'src', '');
      return;
    }

    // Serve instantly from cache if we've already resolved this path before.
    const cached = this.imageCache.getCached(path);
    if (cached) {
      this.renderer.setAttribute(this.el.nativeElement, 'src', cached);
      return;
    }

    this.imageCache.resolve(path).then(url => {
      if (token !== this.requestToken) return; // a newer path was bound since — ignore stale result
      if (url) this.renderer.setAttribute(this.el.nativeElement, 'src', url);
    });
  }
}
