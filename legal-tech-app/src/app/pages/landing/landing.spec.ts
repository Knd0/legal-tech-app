import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock AuthService first
class MockAuthService {
  isAuthenticated = () => false;
  currentUser = () => null;
}

// Mock @angular/core's inject function
vi.mock('@angular/core', async () => {
  const original = await vi.importActual<any>('@angular/core');
  return {
    ...original,
    inject: vi.fn().mockImplementation(() => {
      return new MockAuthService();
    })
  };
});

// Import Landing AFTER mocking core
import { Landing } from './landing';

describe('Landing Component (Vitest)', () => {
  let component: Landing;

  beforeEach(() => {
    component = new Landing();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set active preview tab', () => {
    component.setPreviewTab('kanban');
    expect(component.activePreviewTab()).toBe('kanban');
  });

  it('should toggle billing cycle', () => {
    component.toggleBillingCycle();
    expect(component.billingCycle()).toBe('yearly');
    component.toggleBillingCycle();
    expect(component.billingCycle()).toBe('monthly');
  });
});
