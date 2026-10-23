import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { routes } from './app.routes';
import { userHeaderInterceptor } from './core/auth/session-user.service';
import { demoBackendInterceptor, isDemoBuild } from './core/demo/demo-mode';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([userHeaderInterceptor, demoBackendInterceptor])),
    // the static demo is served as files without a server-side router, so it uses #/ URLs
    isDemoBuild()
      ? provideRouter(routes, withComponentInputBinding(), withHashLocation())
      : provideRouter(routes, withComponentInputBinding()),
  ],
};
