import { Routes } from '@angular/router';

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
    title: 'Sign Up · Gupshup',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    title: 'Login · Gupshup',
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
    title: 'Forgot Password · Gupshup',
  },
  {
    path: 'chats',
    loadComponent: () =>
      import('./features/chats/chat-list/chat-list.component').then((m) => m.ChatListComponent),
    title: 'Chats · Gupshup',
  },
  {
    path: 'chats/:id',
    loadComponent: () =>
      import('./features/chats/chat-detail/chat-detail.component').then((m) => m.ChatDetailComponent),
    title: 'Chat · Gupshup',
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings/settings.component').then((m) => m.SettingsComponent),
    title: 'Settings · Gupshup',
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
    title: 'Page Not Found · Gupshup',
  },
];
