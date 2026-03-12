import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Pricing } from './pricing';

describe('Pricing', () => {
  let component: Pricing;
  let fixture: ComponentFixture<Pricing>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Pricing]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Pricing);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
