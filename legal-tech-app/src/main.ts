import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

console.log('🚀 App Starting...');
console.log('🌍 Environment:', environment.production ? 'Production' : 'Development');
console.log('🔗 API URL:', environment.apiUrl);

platformBrowser().bootstrapModule(AppModule, {
  
})
  .catch(err => console.error(err));
