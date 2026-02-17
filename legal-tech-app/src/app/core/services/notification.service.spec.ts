import { NotificationService } from './notification.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SwPush } from '@angular/service-worker';
import { of, Subject } from 'rxjs';

// Mock de SwPush
class MockSwPush {
  isEnabled = true;
  messages = new Subject<any>();
  notificationClicks = new Subject<any>();
  subscription = of(null);
  
  requestSubscription(options: any) {
    return Promise.resolve({ endpoint: 'test-endpoint' });
  }
}

describe('NotificationService', () => {
  let service: NotificationService;
  let swPush: SwPush;

  beforeEach(() => {
    // Inyección de dependencias manual para test unitario puro con Vitest
    swPush = new MockSwPush() as unknown as SwPush;
    service = new NotificationService(swPush);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should subscribe to notifications successfully', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    
    await service.subscribeToNotifications();
    
    expect(service.isSubscribed()).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith('Usuario suscrito a notificaciones:', { endpoint: 'test-endpoint' });
  });

  it('should NOT subscribe if SwPush is disabled', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    // @ts-ignore
    service['swPush'].isEnabled = false;
    
    service.subscribeToNotifications();
    
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('no está habilitado'));
    expect(service.isSubscribed()).toBe(false); // Should remain false (default) or whatever mock state was
  });
});
