import { TestBed } from '@angular/core/testing';

import { PushNotifications } from './push-notifications';

describe('PushNotifications', () => {
  let service: PushNotifications;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PushNotifications);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
