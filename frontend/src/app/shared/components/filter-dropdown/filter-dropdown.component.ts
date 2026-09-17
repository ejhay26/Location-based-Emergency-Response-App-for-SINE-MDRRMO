import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppIconComponent } from '../app-icon/app-icon.component';
import { CustomTooltipDirective } from '../../directives/custom-tooltip.directive';

export interface FilterDropdownOption {
  value: any;
  label: string;
}

@Component({
  selector: 'app-filter-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent, CustomTooltipDirective],
  templateUrl: './filter-dropdown.component.html',
  styleUrls: ['./filter-dropdown.component.scss']
})
export class FilterDropdownComponent {
  @Input() label = 'Select';
  @Input() icon?: string;
  @Input() options: FilterDropdownOption[] = [];
  @Input() value: any = 'all';
  @Input() defaultValue: any = 'all';
  @Input() searchable = false;
  @Input() searchPlaceholder = 'Search…';
  @Input() showClear = true;
  @Input() multiple = false;
  @Input() pluralLabel?: string;

  @Output() valueChange = new EventEmitter<any>();

  isOpen = false;
  searchQuery = '';

  constructor(private hostEl: ElementRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) return;
    // Check composedPath first to guard against DOM node detachment during Angular re-render
    const path = event.composedPath ? event.composedPath() : [];
    if (path.length > 0 && path.includes(this.hostEl.nativeElement)) {
      return;
    }
    const target = event.target as Node | null;
    if (target && this.hostEl.nativeElement.contains(target)) {
      return;
    }
    this.isOpen = false;
  }

  get hasFilter(): boolean {
    if (this.multiple) {
      return Array.isArray(this.value) && this.value.length > 0;
    }
    return this.value !== this.defaultValue;
  }

  get currentLabel(): string {
    if (this.multiple) {
      if (!Array.isArray(this.value) || this.value.length === 0) {
        return this.label;
      }
      if (this.value.length === 1) {
        const single = this.options.find(opt => String(opt.value) === String(this.value[0]));
        return single ? single.label : this.label;
      }
      return `${this.value.length} ${this.pluralLabel || 'Selected'}`;
    }
    const found = this.options.find(opt => String(opt.value) === String(this.value));
    return found ? found.label : this.label;
  }

  get filteredOptions(): FilterDropdownOption[] {
    if (!this.searchQuery || !this.searchQuery.trim()) {
      return this.options;
    }
    const q = this.searchQuery.toLowerCase().trim();
    return this.options.filter(opt => opt.label.toLowerCase().includes(q));
  }

  isSelected(val: any): boolean {
    if (this.multiple) {
      if (val === 'all') {
        return !Array.isArray(this.value) || this.value.length === 0;
      }
      return Array.isArray(this.value) && this.value.some((v: any) => String(v) === String(val));
    }
    return String(this.value) === String(val);
  }

  trackByOption(_index: number, opt: FilterDropdownOption): any {
    return opt.value;
  }

  toggleMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    event?.preventDefault();
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.searchQuery = '';
    }
  }

  selectOption(val: any, event?: MouseEvent): void {
    event?.stopPropagation();
    event?.preventDefault();
    if (this.multiple) {
      if (val === 'all') {
        this.value = [];
        this.valueChange.emit([]);
      } else {
        if (!Array.isArray(this.value)) {
          this.value = [];
        }
        const numVal = typeof val === 'number' ? val : (isNaN(+val) ? val : +val);
        const exists = this.value.some((v: any) => String(v) === String(numVal));
        if (exists) {
          this.value = this.value.filter((v: any) => String(v) !== String(numVal));
        } else {
          this.value = [...this.value, numVal];
        }
        this.valueChange.emit([...this.value]);
      }
      // Keep menu open for multi-select so user can combine multiple items
    } else {
      this.value = val;
      this.valueChange.emit(val);
      this.isOpen = false;
    }
  }

  clear(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.multiple) {
      this.value = [];
      this.valueChange.emit([]);
    } else {
      this.value = this.defaultValue;
      this.valueChange.emit(this.defaultValue);
    }
    this.isOpen = false;
  }
}
