import { TestBed } from '@angular/core/testing';

import { Tour } from './tour';

describe('Tour', () => {
  let service: Tour;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Tour);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
