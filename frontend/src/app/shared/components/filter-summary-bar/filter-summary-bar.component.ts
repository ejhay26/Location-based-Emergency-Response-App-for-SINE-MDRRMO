import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton } from '@ionic/angular/standalone';

/**
 * FilterSummaryBarComponent — "Filtered by: X · Y · Z  [Clear all]" strip
 * shown under a panel's header whenever one or more filters are active
 * (search text, status, barangay, date, etc). One shared implementation so
 * every list panel (Citizens, Dispatchers, Verifications, Log Archive,
 * Analytics) renders this the same way instead of duplicating the markup.
 *
 * The parent panel is the single source of truth for its filter state; this
 * component only renders whatever chip labels it's given and reports back
 * when the user asks to clear everything.
 */
@Component({
  selector: 'app-filter-summary-bar',
  standalone: true,
  imports: [CommonModule, IonButton],
  templateUrl: './filter-summary-bar.component.html',
})
export class FilterSummaryBarComponent {
  /** Human-readable labels for each currently-active filter (e.g. "Poblacion", "Aug 1 – Aug 5, 2026"). */
  @Input() chips: string[] = [];
  @Output() clearAll = new EventEmitter<void>();

  get isActive(): boolean {
    return this.chips.length > 0;
  }
}
