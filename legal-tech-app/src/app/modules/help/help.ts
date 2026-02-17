import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChildren, QueryList } from '@angular/core';

@Component({
  selector: 'app-help',
  standalone: false,
  templateUrl: './help.html',
  styleUrl: './help.css',
})
export class Help implements AfterViewInit, OnDestroy {
  activeSection = 'intro';
  private observer: IntersectionObserver | null = null;

  sections = [
    { id: 'intro', label: 'Introducción', icon: 'pi pi-compass' },
    { id: 'dashboard', label: 'Panel de Control', icon: 'pi pi-home' },
    { id: 'clientes', label: 'Clientes', icon: 'pi pi-users' },
    { id: 'expedientes', label: 'Expedientes', icon: 'pi pi-briefcase' },
    { id: 'calendario', label: 'Agenda y Vencimientos', icon: 'pi pi-calendar' },
    { id: 'configuracion', label: 'Configuración', icon: 'pi pi-cog' }
  ];

  constructor(private el: ElementRef) {}

  ngAfterViewInit() {
    this.setupObserver();
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private setupObserver() {
    const options = {
      root: this.el.nativeElement.querySelector('main'), // The scrollable container
      rootMargin: '-50% 0px -50% 0px', // Trigger when element is in the middle of viewport
      threshold: 0
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Only update if it's one of our known sections
            const id = entry.target.getAttribute('id');
            if (id && this.sections.some(s => s.id === id)) {
                this.activeSection = id;
            }
        }
      });
    }, options);

    // Observe all section elements
    this.sections.forEach(section => {
      const element = document.getElementById(section.id);
      if (element) {
        this.observer?.observe(element);
      }
    });
  }

  scrollTo(sectionId: string) {
    this.activeSection = sectionId;
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
