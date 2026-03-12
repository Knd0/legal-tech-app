import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Success } from './success';

describe('Success', () => {
  let component: Success;
  let fixture: ComponentFixture<Success>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Success]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Success);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
