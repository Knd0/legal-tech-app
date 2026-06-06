import { Help } from './help';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Help Component (Vitest)', () => {
  let component: Help;
  let mockEl: any;

  beforeEach(() => {
    mockEl = {
      nativeElement: {
        querySelector: () => document.createElement('div')
      }
    };
    component = new Help(mockEl);
  });

  it('should create component instance', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize active section as intro', () => {
    expect(component.activeSection).toBe('intro');
  });

  it('should filter sections based on category', () => {
    component.selectedCategory = 'ia';
    const sections = component.getFilteredSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections.every(s => s.category === 'ia')).toBe(true);
  });

  it('should search help topics correctly', () => {
    component.searchQuery = 'cuit';
    const results = component.getSearchResults();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain('AFIP');
  });

  it('should trigger simulation actions', () => {
    component.generateMockDraft('demanda');
    expect(component.isAiGenerating).toBe(true);
  });
});
