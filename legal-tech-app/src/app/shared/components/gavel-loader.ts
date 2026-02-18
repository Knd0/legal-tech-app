import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-gavel-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col items-center justify-center p-8 space-y-4 min-h-[200px]">
      <div class="gavel-container relative w-32 h-32">
        <!-- Sound Block -->
        <div class="sound-block absolute bottom-4 left-1/2 -translate-x-1/2 w-20 h-6 bg-amber-900 rounded-sm shadow-md"></div>
        
        <!-- Gavel Wrapper for Pivot -->
        <div class="gavel-wrapper absolute top-0 left-1/2 w-full h-full -translate-x-1/2 origin-[70%_80%] animate-hammer">
             <!-- Handle -->
             <div class="handle absolute top-4 left-1/2 w-3 h-24 bg-amber-800 -translate-x-1/2 rounded-full border border-amber-900 shadow-sm"></div>
             <!-- Head -->
             <div class="head absolute top-4 left-1/2 w-16 h-8 bg-slate-800 -translate-x-1/2 -translate-y-1/2 rounded-sm flex items-center justify-between px-1 shadow-lg border border-slate-700">
                <div class="w-1 h-full bg-slate-600/30"></div>
                <!-- Shine effect -->
                <div class="absolute top-1 right-2 w-2 h-2 bg-white/20 rounded-full"></div>
                <div class="w-1 h-full bg-slate-600/30"></div>
             </div>
        </div>
      </div>
      <p class="text-sm font-bold text-slate-500 dark:text-slate-400 animate-pulse tracking-wide">CARGANDO...</p>
    </div>
  `,
  styles: [`
    .animate-hammer {
        animation: hammer 1.2s infinite ease-in-out;
    }
    
    @keyframes hammer {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-25deg); } /* Raise */
        50% { transform: rotate(5deg); } /* Hit */
        60% { transform: rotate(0deg); } /* Settle */
    }
  `]
})
export class GavelLoaderComponent {}


@Component({
  selector: 'app-gavel-loader',
  standalone: false,
  templateUrl: './gavel-loader.html',
  styleUrl: './gavel-loader.scss',
})
export class GavelLoader {

}
