import { NotificationService } from './notification.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SwPush } from '@angular/service-worker';
import { of, Subject } from 'rxjs';
import { signal } from '@angular/core';

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
  let mockHttp: any;

  beforeEach(() => {
    // Inyección de dependencias manual para test unitario puro con Vitest
    swPush = new MockSwPush() as unknown as SwPush;
    mockHttp = {
      get: vi.fn().mockReturnValue(of({ publicKey: 'test-vapid-public-key' })),
      post: vi.fn().mockReturnValue(of({ success: true }))
    };
    service = new NotificationService(swPush, mockHttp as any);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should subscribe to notifications successfully', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    
    await service.subscribeToNotifications();
    
    // Since subscribeToNotifications runs async flow via observables, let's wait a tick
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(mockHttp.get).toHaveBeenCalledWith(expect.stringContaining('/notifications/vapid-public-key'));
    expect(mockHttp.post).toHaveBeenCalledWith(expect.stringContaining('/notifications/subscribe'), { endpoint: 'test-endpoint' });
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

  it('should request notification permission', async () => {
    // Mock window and Notification
    const originalWindow = (globalThis as any).window;
    const originalNotification = (globalThis as any).Notification;
    
    (globalThis as any).window = globalThis;
    (globalThis as any).Notification = {
      permission: 'default',
      requestPermission: () => Promise.resolve('granted')
    };
    
    const granted = await service.requestNativePermission();
    expect(granted).toBe(true);
    
    (globalThis as any).window = originalWindow;
    (globalThis as any).Notification = originalNotification;
  });

  it('should trigger popup for calendar events starting soon', () => {
    const mockHttp = { get: () => of([]), post: () => of({}) } as any;
    const mockAuth = { isAuthenticated: () => true } as any;
    
    // An event starting in 5 minutes
    const futureDate = new Date();
    futureDate.setMinutes(futureDate.getMinutes() + 5);
    
    const mockEvents = [
      { id: 'event-1', titulo: 'Reunión de Prueba', fecha: futureDate, tipo: 'REUNION' }
    ];
    const mockCalendar = { events: () => mockEvents } as any;
    const mockDeadline = { deadlines: () => [] } as any;
    
    const customService = new NotificationService(swPush, mockHttp, mockAuth, mockDeadline, mockCalendar);
    
    // Spy on triggerPopup
    const spy = vi.spyOn(customService, 'triggerPopup').mockImplementation(() => {});
    
    customService.checkCalendarEvents();
    
    expect(spy).toHaveBeenCalledWith(
      'Próximo Evento en Calendario',
      expect.stringContaining('Reunión de Prueba'),
      false
    );
  });

  it('should trigger warning popup for perentorio/today deadlines', () => {
    const mockHttp = { get: () => of([]), post: () => of({}) } as any;
    const mockAuth = { isAuthenticated: () => true } as any;
    
    // A deadline due today
    const todayDate = new Date();
    
    const mockDeadlines = [
      { id: 'deadline-1', titulo: 'Presentar Escrito', fechaVencimiento: todayDate, estado: 'PENDIENTE', esPerentorio: true }
    ];
    const mockCalendar = { events: () => [] } as any;
    const mockDeadline = { deadlines: () => mockDeadlines } as any;
    
    const customService = new NotificationService(swPush, mockHttp, mockAuth, mockDeadline, mockCalendar);
    
    // Spy on triggerPopup
    const spy = vi.spyOn(customService, 'triggerPopup').mockImplementation(() => {});
    
    customService.checkDeadlines();
    
    expect(spy).toHaveBeenCalledWith(
      '⚠️ Vencimiento HOY',
      expect.stringContaining('Presentar Escrito'),
      true
    );
  });
});
