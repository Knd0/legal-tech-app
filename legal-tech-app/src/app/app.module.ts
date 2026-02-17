import { NgModule, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { HttpClientModule, provideHttpClient, withInterceptors } from '@angular/common/http';
import { MenubarModule } from 'primeng/menubar';
import { authInterceptor } from './core/interceptors/auth-interceptor';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ServiceWorkerModule } from '@angular/service-worker';
import { PanelModule } from 'primeng/panel';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SharedModule } from './shared/shared-module';
import { FooterComponent } from './shared/components/footer/footer.component';

import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';



@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    CommonModule,
    HttpClientModule,
    AppRoutingModule,
    MenubarModule,
    PanelModule,
    ButtonModule,
    TooltipModule,
    SharedModule,
    FooterComponent,
    
      ServiceWorkerModule.register('ngsw-worker.js', {
        enabled: !isDevMode(),
        // Register the ServiceWorker as soon as the application is stable
        // or after 30 seconds (whichever comes first).
        registrationStrategy: 'registerWhenStable:30000'
      })
    
  ],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    providePrimeNG({ 
        theme: {
            preset: Aura,
            options: {
                darkModeSelector: false || 'none'
            }
        }
    })
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
