import { Component, inject, signal, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing implements AfterViewInit, OnDestroy {
  authService = inject(AuthService);
  
  activePreviewTab = signal<'dashboard' | 'kanban' | 'copilot' | 'afip' | 'whatsapp'>('dashboard');
  billingCycle = signal<'monthly' | 'yearly'>('monthly');

  private canvasId = 'networkConstellation';
  private rafId: number = 0;
  private mouse = { x: -1000, y: -1000 };
  private isVisible = true;

  // Listeners stored to clean up on component destruction
  private resizeListener?: () => void;
  private mouseMoveListener?: (e: MouseEvent) => void;
  private visibilityListener?: () => void;

  setPreviewTab(tab: 'dashboard' | 'kanban' | 'copilot' | 'afip' | 'whatsapp') {
    this.activePreviewTab.set(tab);
  }

  toggleBillingCycle() {
    this.billingCycle.update(c => c === 'monthly' ? 'yearly' : 'monthly');
  }

  ngAfterViewInit() {
    const canvas = document.getElementById('networkCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const particleCount = window.innerWidth < 768 ? 40 : 85;
    const connectionDistance = 180;
    const mouseDistance = 250;

    // Initialize particles
    const particles: Particle[] = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      radius: Math.random() * 2.2 + 1.2,
    }));

    this.mouseMoveListener = (e: MouseEvent) => {
      this.mouse = { x: e.clientX, y: e.clientY };
    };

    this.resizeListener = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    this.visibilityListener = () => {
      this.isVisible = document.visibilityState === 'visible';
    };

    window.addEventListener('mousemove', this.mouseMoveListener, { passive: true });
    window.addEventListener('resize', this.resizeListener, { passive: true });
    document.addEventListener('visibilitychange', this.visibilityListener);

    const animate = () => {
      if (!this.isVisible) {
        this.rafId = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Draw in Organic earth tones: Terracotta (198, 107, 61) and Moss (96, 108, 56)
      const rgbTerracotta = '198, 107, 61';
      const rgbMoss = '96, 108, 56';
      const rgbLine = '96, 75, 60'; // Darker clay color for higher contrast

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Mouse interaction
        const dx = this.mouse.x - p.x;
        const dy = this.mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let alpha = 0.65;
        if (dist < mouseDistance) {
          alpha = 0.65 + (1 - dist / mouseDistance) * 0.30;
        }

        // Alternate particle colors between Terracotta and Moss
        const pRgb = i % 2 === 0 ? rgbTerracotta : rgbMoss;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pRgb}, ${alpha})`;
        ctx.fill();

        // Draw connections between particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const ddx = p.x - p2.x;
          const ddy = p.y - p2.y;
          const distance = Math.sqrt(ddx * ddx + ddy * ddy);

          if (distance < connectionDistance) {
            const lineAlpha = (1 - distance / connectionDistance) * 0.32;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(${rgbLine}, ${lineAlpha})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }

        // Draw connection to mouse
        if (dist < mouseDistance) {
          const lineAlpha = (1 - dist / mouseDistance) * 0.42;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(this.mouse.x, this.mouse.y);
          ctx.strokeStyle = `rgba(${rgbLine}, ${lineAlpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      this.rafId = requestAnimationFrame(animate);
    };

    animate();
  }

  ngOnDestroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    if (this.mouseMoveListener) {
      window.removeEventListener('mousemove', this.mouseMoveListener);
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
    if (this.visibilityListener) {
      document.removeEventListener('visibilitychange', this.visibilityListener);
    }
  }
}
