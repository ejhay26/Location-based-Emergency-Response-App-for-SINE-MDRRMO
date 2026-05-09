import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HazardPage } from './hazard.page';

describe('HazardPage', () => {
  let component: HazardPage;
  let fixture: ComponentFixture<HazardPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(HazardPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
