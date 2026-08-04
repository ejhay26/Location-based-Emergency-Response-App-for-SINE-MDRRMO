import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonPopover, IonDatetime, IonSegment, IonSegmentButton, IonLabel } from '@ionic/angular/standalone';
import { DateFilterMode, DateFilterValue, formatDateFilterLabel } from '../../utils/date-filter.util';

let instanceCounter = 0;

/** Extracts the 'YYYY-MM-DD' portion from an ion-datetime ISO value string. */
function toDateOnly(iso: string): string {
  return iso.split('T')[0];
}

/** Dedupes + sorts a batch of ion-datetime picks (which may arrive as string | string[] | null). */
function normalizePicks(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? [raw] : []);
  return [...new Set(arr.filter((v): v is string => typeof v === 'string').map(toDateOnly))].sort();
}

/**
 * DateRangeFilterComponent - the "[calendar icon] Select a Date" button used
 * across every admin list panel (Analytics, Log Archive, Citizens,
 * Dispatchers, ID Verifications). One implementation, reused everywhere,
 * instead of a bespoke popover per panel.
 *
 * Offers three selection modes via a segmented control - One Day / Several
 * Days / Date Range - sharing a SINGLE <ion-datetime> element that is never
 * destroyed/recreated. Three implementation notes, each a fix for a real
 * bug found in testing:
 *
 * 1. `calendarValue` is a plain field, not a template getter. A getter that
 *    builds a fresh array on every read (e.g. for range mode) hands Angular
 *    a new object identity on *every* change-detection cycle even when
 *    nothing changed, and ion-datetime treats each one as a genuine "value
 *    changed" event - which was forcing its visible month back to the
 *    selected date any time the user tried to browse to another month. A
 *    stable field only changes when *we* deliberately reassign it.
 *
 * 2. Switching modes, reopening the popover, or clearing calls
 *    `datetimeRef.reset(startDate?)` - ion-datetime's own public method for
 *    resetting its internal selection/navigation state. This replaces an
 *    earlier approach that destroyed and recreated the element (via *ngIf)
 *    to force a clean state, which worked but caused a visible flash as the
 *    calendar vanished and reappeared. reset() achieves the same clean
 *    state without ever unmounting the element.
 *
 * 3. In multi-select modes (Several Days / Date Range), every pick is fed
 *    back through `[value]` sorted chronologically (oldest first) so the
 *    filter's own start/end semantics stay correct - but ion-datetime
 *    appears to navigate its view based on array order, which was causing
 *    it to jump to the *later* date's month even when the user was actively
 *    editing the *earlier* one. Each tap now explicitly calls
 *    `datetimeRef.reset(tappedDate)` with the exact date just tapped
 *    (reset() does not touch the value/selection, only navigation), so the
 *    view always follows the user's most recent tap regardless of how the
 *    dates get reordered for storage.
 */
@Component({
  selector: 'app-date-range-filter',
  standalone: true,
  imports: [CommonModule, IonButton, IonPopover, IonDatetime, IonSegment, IonSegmentButton, IonLabel],
  templateUrl: './date-range-filter.component.html',
})
export class DateRangeFilterComponent {

  /** The currently applied filter (owned/persisted by the parent panel). */
  @Input() value: DateFilterValue | null = null;
  /** Emits the new applied filter on Apply, or null on Clear. */
  @Output() valueChange = new EventEmitter<DateFilterValue | null>();

  @ViewChild(IonDatetime) datetimeRef?: IonDatetime;

  /** Unique per-instance trigger id - required by ion-popover's [trigger] and
   *  safe even if this component is ever used more than once on the same page. */
  readonly triggerId = `date-range-filter-trigger-${instanceCounter++}`;

  // Draft state, edited inside the popover; only committed to `value` on Apply.
  pendingMode: DateFilterMode = 'single';
  pendingSingle: string | null = null;
  pendingMultiple: string[] = [];
  pendingRangeStart: string | null = null;
  pendingRangeEnd: string | null = null;

  /** The one shared calendar's bound value. A plain field (see class doc, point 1). */
  calendarValue: string | string[] | null = null;

  get hasValue(): boolean {
    return !!this.value && this.value.dates.length > 0;
  }

  get displayLabel(): string {
    return formatDateFilterLabel(this.value);
  }

  get isMultipleCalendar(): boolean {
    return this.pendingMode !== 'single';
  }

  get canApply(): boolean {
    if (this.pendingMode === 'single')   return !!this.pendingSingle;
    if (this.pendingMode === 'multiple') return this.pendingMultiple.length > 0;
    return !!this.pendingRangeStart && !!this.pendingRangeEnd;
  }

  /** Shades the days strictly between Start and End when a range is being built, for visual feedback on the shared calendar. */
  rangeHighlight = (isoString: string): { textColor?: string; backgroundColor?: string; border?: string } | undefined => {
    if (this.pendingMode !== 'range' || !this.pendingRangeStart || !this.pendingRangeEnd) return undefined;
    const day = toDateOnly(isoString);
    if (day > this.pendingRangeStart && day < this.pendingRangeEnd) {
      return { textColor: '#eb445a', backgroundColor: 'rgba(235,68,90,0.15)' };
    }
    return undefined;
  };

  /** Recomputes the stable `calendarValue` field from whichever pending-state fields are live for the current mode. */
  private syncCalendarValue(): void {
    if (this.pendingMode === 'single') {
      this.calendarValue = this.pendingSingle;
    } else if (this.pendingMode === 'multiple') {
      this.calendarValue = this.pendingMultiple;
    } else {
      const range: string[] = [];
      if (this.pendingRangeStart) range.push(this.pendingRangeStart);
      if (this.pendingRangeEnd) range.push(this.pendingRangeEnd);
      this.calendarValue = range;
    }
  }

  private clearPendingSelection(): void {
    this.pendingSingle = null;
    this.pendingMultiple = [];
    this.pendingRangeStart = null;
    this.pendingRangeEnd = null;
  }

  /** Thin wrapper around ion-datetime's reset() so a rejected promise (e.g. if the
   *  element isn't ready yet) can never surface as an unhandled rejection. */
  private resetCalendar(startDate?: string): void {
    this.datetimeRef?.reset(startDate)?.catch(() => { /* non-critical: worst case the view just doesn't navigate */ });
  }

  /** Re-syncs draft state from the applied value every time the popover opens,
   *  so reopening it reflects what's actually active rather than a stale edit. */
  onOpen(): void {
    const v = this.value;
    this.pendingMode        = v?.mode ?? 'single';
    this.pendingSingle      = v?.mode === 'single'   ? (v.dates[0] ?? null) : null;
    this.pendingMultiple    = v?.mode === 'multiple' ? [...v.dates] : [];
    this.pendingRangeStart  = v?.mode === 'range'    ? (v.dates[0] ?? null) : null;
    this.pendingRangeEnd    = v?.mode === 'range'    ? (v.dates[1] ?? null) : null;
    this.syncCalendarValue();
    // Navigate the view to whatever's applied (or today, if nothing is applied) without unmounting.
    this.resetCalendar(this.pendingSingle ?? this.pendingRangeStart ?? this.pendingMultiple[0] ?? undefined);
  }

  /** Switching modes always starts from a clean slate - no leftover picks
   *  carried over from whichever mode was active before (this was the
   *  reported "switch to Multiple, switch back, my Single pick is still
   *  there" bug: separate mode variables were kept alive across switches). */
  onModeChange(ev: CustomEvent): void {
    const mode = (ev.detail as { value: DateFilterMode }).value;
    if (mode !== 'single' && mode !== 'multiple' && mode !== 'range') return;
    if (mode === this.pendingMode) return;
    this.pendingMode = mode;
    this.clearPendingSelection();
    this.syncCalendarValue();
    this.resetCalendar();
  }

  /** Single ionChange handler for the one shared calendar; behavior branches on the active mode. */
  onCalendarChange(ev: CustomEvent): void {
    const raw = (ev.detail as { value: unknown }).value;

    if (this.pendingMode === 'single') {
      this.pendingSingle = typeof raw === 'string' ? toDateOnly(raw) : null;
      this.syncCalendarValue();
      return;
    }

    const picked = normalizePicks(raw);

    if (this.pendingMode === 'multiple') {
      const previouslyPicked = new Set(this.pendingMultiple);
      // Whichever date wasn't already selected is the one just tapped; falls back
      // to the last remaining date if this tap was a de-selection instead.
      const justTapped = picked.find(d => !previouslyPicked.has(d)) ?? picked[picked.length - 1] ?? null;
      this.pendingMultiple = picked;
      this.syncCalendarValue();
      if (justTapped) this.resetCalendar(justTapped);
      return;
    }

    // Range mode: the calendar always represents exactly the Start/End
    // endpoints, however many days were tapped along the way - tapping a
    // 3rd, outer day extends the range; tapping an inner day is dropped on
    // the next render since only the two extremes are ever fed back in.
    const previousAnchors = new Set([this.pendingRangeStart, this.pendingRangeEnd].filter((d): d is string => !!d));
    const justTapped = picked.find(d => !previousAnchors.has(d)) ?? picked[picked.length - 1] ?? null;

    if (picked.length === 0) {
      this.pendingRangeStart = null;
      this.pendingRangeEnd = null;
    } else {
      this.pendingRangeStart = picked[0];
      this.pendingRangeEnd = picked.length > 1 ? picked[picked.length - 1] : null;
    }
    this.syncCalendarValue();
    // Explicitly navigate to the date the user just tapped - without this, ion-datetime
    // seems to navigate based on array order, which meant editing an earlier Start date
    // while a later End date already existed would jump the view back to End's month.
    if (justTapped) this.resetCalendar(justTapped);
  }

  onApply(): void {
    if (!this.canApply) return;

    if (this.pendingMode === 'single') {
      this.valueChange.emit({ mode: 'single', dates: [this.pendingSingle!] });
    } else if (this.pendingMode === 'multiple') {
      this.valueChange.emit({ mode: 'multiple', dates: [...this.pendingMultiple] });
    } else {
      this.valueChange.emit({ mode: 'range', dates: [this.pendingRangeStart!, this.pendingRangeEnd!] });
    }
  }

  onClear(): void {
    this.clearPendingSelection();
    this.syncCalendarValue();
    this.resetCalendar();
    this.valueChange.emit(null);
  }
}
