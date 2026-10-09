import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './shared/services/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./features/auth/signup/signup.component').then((m) => m.SignupComponent),
    canActivate: [guestGuard],
    title: 'Sign Up · Gupshup',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
    title: 'Login · Gupshup',
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
    canActivate: [guestGuard],
    title: 'Forgot Password · Gupshup',
  },
  {
    path: 'chats',
    loadComponent: () =>
      import('./features/chats/chat-list/chat-list.component').then((m) => m.ChatListComponent),
    canActivate: [authGuard],
    title: 'Chats · Gupshup',
  },
  {
    path: 'chats/:id/info',
    loadComponent: () =>
      import('./features/chats/contact-info/contact-info.component').then(
        (m) => m.ContactInfoComponent
      ),
    canActivate: [authGuard],
    title: 'Contact Info · Gupshup',
  },
  {
    path: 'chats/:id',
    loadComponent: () =>
      import('./features/chats/chat-detail/chat-detail.component').then((m) => m.ChatDetailComponent),
    canActivate: [authGuard],
    title: 'Chat · Gupshup',
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings/settings.component').then((m) => m.SettingsComponent),
    canActivate: [authGuard],
    title: 'Settings · Gupshup',
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
    title: '404 · Page Not Found',
  },
];
