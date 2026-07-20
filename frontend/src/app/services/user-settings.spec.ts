import { TestBed } from '@angular/core/testing';

import { UserSettings } from './user-settings';

describe('UserSettings', () => {
  let service: UserSettings;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserSettings);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
