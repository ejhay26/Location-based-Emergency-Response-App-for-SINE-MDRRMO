import { TestBed } from '@angular/core/testing';

import { OtpAutofill } from './otp-autofill';

describe('OtpAutofill', () => {
  let service: OtpAutofill;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OtpAutofill);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
