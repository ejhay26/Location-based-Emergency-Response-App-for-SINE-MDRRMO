import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TourService } from '../../../../../core/services/tour';

interface IncidentType { id: number; name: string; icon: string; color: string; }
interface HazardCategory { id: string; name: string; icon: string; color: string; }

/**
 * ReportTypeSelectorComponent — the incident/hazard type grid extracted from
 * report.page. Owns its own selection state (there is no other consumer of
 * incident_type_id / hazard_type besides this grid's own clicks, so keeping
 * the selection local and emitting only the chosen id upward is behaviorally
 * identical to the original form-bound implementation).
 */
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

@Component({
  selector: 'app-report-type-selector',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './report-type-selector.component.html',
})
export class ReportTypeSelectorComponent {
  public tour = inject(TourService);

  @Input() reportType: 'emergency' | 'hazard' = 'emergency';

  @Output() incidentTypeChange = new EventEmitter<number>();
  @Output() hazardTypeChange = new EventEmitter<string>();

  incidentTypes: IncidentType[] = [
    { id: 1, name: 'Fire',    icon: 'flame',         color: '#eb445a' },
    { id: 2, name: 'Flood',   icon: 'droplet',       color: '#3880ff' },
    { id: 3, name: 'Medical', icon: 'medical',       color: '#2dd36f' },
    { id: 4, name: 'Crime',   icon: 'shield-alert',  color: '#bc6fff' },
    { id: 5, name: 'Others',  icon: 'circle-question', color: '#92949c' }
  ];

  hazardCategories: HazardCategory[] = [
    { id: 'Flooded Street',   name: 'Flooded Street',   icon: 'droplet',         color: '#3880ff' },
    { id: 'Road Obstruction', name: 'Road Obstruction', icon: 'hazard',          color: '#ffc409' },
    { id: 'Downed Wire',      name: 'Downed Wire',      icon: 'zap',             color: '#e0ac00' },
    { id: 'Fallen Tree',      name: 'Fallen Tree',      icon: 'trees',           color: '#2dd36f' },
    { id: 'Others',           name: 'Others',           icon: 'circle-question', color: '#92949c' }
  ];

  selectedIncidentId: number | '' = '';
  selectedIncidentName = 'None';

  selectedHazardId: string | '' = '';
  selectedHazardName = 'None';

  selectIncident(type: IncidentType) {
    this.selectedIncidentId = type.id;
    this.selectedIncidentName = type.name;
    this.tour.onInteraction();
    this.incidentTypeChange.emit(type.id);
  }

  selectHazard(cat: HazardCategory) {
    this.selectedHazardId = cat.id;
    this.selectedHazardName = cat.name;
    this.tour.onInteraction();
    this.hazardTypeChange.emit(cat.id);
  }
}
