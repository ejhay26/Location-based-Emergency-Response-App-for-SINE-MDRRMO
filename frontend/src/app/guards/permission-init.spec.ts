import { TestBed } from '@angular/core/testing';

import { PermissionInitService } from './permission-init';

describe('PermissionInitService', () => {
  let service: PermissionInitService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PermissionInitService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
