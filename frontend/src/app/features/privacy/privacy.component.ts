import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SvgIconComponent } from '../../shared/components/svg-icon/svg-icon.component';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, RouterLink, SvgIconComponent],
  template: `
    <div class="privacy-screen">
      <!-- Header -->
      <header class="privacy-header">
        <button
          type="button"
          class="back-btn"
          (click)="goBack()"
          aria-label="Go back"
        >
          <app-svg-icon name="back" [size]="20"></app-svg-icon>
        </button>
        <div class="header-title-wrap">
          <h1 class="header-title">Privacy Policy</h1>
          <span class="header-sub">Gupshup</span>
        </div>
        <div class="header-shield" aria-hidden="true">
          <app-svg-icon name="shield" [size]="18"></app-svg-icon>
        </div>
      </header>

      <!-- Scrollable Policy Content -->
      <div class="privacy-body">
        <!-- Badge & Intro -->
        <div class="intro-block">
          <div class="date-badge">
            <app-svg-icon name="clock" [size]="13"></app-svg-icon>
            <span>Last updated: October 11, 2026</span>
          </div>
          <p class="intro-text">
            Welcome to <strong>Gupshup</strong> — a cosy, real-time messaging space.
            Your privacy is important to us. This policy clearly explains what information we collect,
            how we use and store it, and how you can exercise full control over your data.
          </p>
        </div>

        <!-- Section 1: Data We Collect -->
        <section class="policy-card">
          <div class="card-title-row">
            <span class="num-bubble">1</span>
            <h2 class="card-title">Information We Collect</h2>
          </div>
          <p class="card-text">
            To provide a seamless messaging experience, we collect only the information necessary for your account and conversations:
          </p>
          <ul class="policy-list">
            <li>
              <strong>Account Profile:</strong> Your display name, email address, unique username, and securely hashed password.
            </li>
            <li>
              <strong>Profile Photo:</strong> An optional avatar picture you choose to upload to personalize your account.
            </li>
            <li>
              <strong>Messages & Attachments:</strong> The text messages, photos, images, and file attachments you share with your contacts.
            </li>
            <li>
              <strong>Live Presence:</strong> Real-time connection indicators (online status, last seen, and typing state) so conversations feel responsive.
            </li>
          </ul>
        </section>

        <!-- Section 2: Google Sign-In -->
        <section class="policy-card">
          <div class="card-title-row">
            <span class="num-bubble">2</span>
            <h2 class="card-title">Google Sign-In</h2>
          </div>
          <p class="card-text">
            When you log in or sign up using Google, we only use Google authentication to verify your identity:
          </p>
          <ul class="policy-list">
            <li>We receive only your basic profile information: your <strong>name</strong> and <strong>email address</strong>.</li>
            <li>Google sign-in is used solely to authenticate your login.</li>
            <li>We <strong>never</strong> access your Google Drive files, contacts, Gmail messages, or any other personal Google data.</li>
          </ul>
        </section>

        <!-- Section 3: Media & Files on Cloudinary -->
        <section class="policy-card">
          <div class="card-title-row">
            <span class="num-bubble">3</span>
            <h2 class="card-title">Photos & File Storage (Cloudinary)</h2>
          </div>
          <p class="card-text">
            Profile photos and media files you share in chats are securely stored on <strong>Cloudinary</strong>, an industry-standard media cloud service.
          </p>
          <p class="card-text">
            Uploaded files are stored solely so you and your conversation partners can view and download them within Gupshup.
          </p>
        </section>

        <!-- Section 4: Database & Infrastructure -->
        <section class="policy-card">
          <div class="card-title-row">
            <span class="num-bubble">4</span>
            <h2 class="card-title">Database & Security</h2>
          </div>
          <p class="card-text">
            Your user profile, relationship settings, and conversation records are stored in our managed database.
            Real-time delivery and transient session caching are handled securely via Redis.
          </p>
          <p class="card-text">
            All communication between your browser and our servers is encrypted in transit using standard HTTPS / TLS protocols.
          </p>
        </section>

        <!-- Section 5: We Do Not Sell Data -->
        <section class="policy-card highlight-card">
          <div class="card-title-row">
            <span class="num-bubble">5</span>
            <h2 class="card-title">We Do Not Sell Your Data</h2>
          </div>
          <p class="card-text">
            We believe in honest, private communication. We <strong>do not sell, rent, monetize, or trade</strong>
            your personal data, messages, or files to third parties or advertising networks. Ever.
          </p>
        </section>

        <!-- Section 6: Data Deletion & Your Rights -->
        <section class="policy-card">
          <div class="card-title-row">
            <span class="num-bubble">6</span>
            <h2 class="card-title">Account & Data Deletion</h2>
          </div>
          <p class="card-text">
            You have full ownership of your personal data. You can request the complete deletion of your account,
            profile, and all associated messages and media at any time.
          </p>
          <div class="email-box">
            <span class="email-label">To request deletion, contact:</span>
            <a href="mailto:azeenfatima614@gmail.com" class="email-link">
              azeenfatima614&#64;gmail.com
            </a>
          </div>
          <p class="card-subtext">
            Upon receiving your request, we will permanently purge your account and stored records from our database.
          </p>
        </section>

        <!-- Footer / Contact -->
        <div class="privacy-foot">
          <p class="foot-text">
            Questions about our privacy practices? Reach out anytime at
            <a href="mailto:azeenfatima614@gmail.com" class="foot-link">azeenfatima614&#64;gmail.com</a>.
          </p>
          <div class="foot-nav">
            <a [routerLink]="authService.isAuthenticated() ? '/chats' : '/login'" class="brand-link">
              ← Return to {{ authService.isAuthenticated() ? 'Chats' : 'Log in' }}
            </a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      height: 100%;
      width: 100%;
      overflow: hidden;
    }

    .privacy-screen {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      min-height: 0;
      width: 100%;
      background-color: var(--card);
      overflow: hidden;
      position: relative;
    }

    .privacy-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 12px;
      background-color: var(--card);
      flex-shrink: 0;
      z-index: 10;
    }

    .back-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      cursor: pointer;
      transition: color 0.15s ease, background-color 0.15s ease;
      outline: none;

      &:hover {
        color: var(--ink);
        background-color: var(--input);
      }

      &:focus-visible {
        outline: 2px solid var(--amber);
        outline-offset: 2px;
      }
    }

    .header-title-wrap {
      flex: 1;
      min-width: 0;
    }

    .header-title {
      font-size: 16px;
      font-weight: 800;
      color: var(--ink);
      margin: 0;
      line-height: 1.2;
    }

    .header-sub {
      font-size: 11.5px;
      color: var(--amber-text);
      font-weight: 700;
    }

    .header-shield {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--msgbtn-bg);
      color: var(--amber-text);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .privacy-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 20px 18px 28px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      -webkit-overflow-scrolling: touch;
    }

    .intro-block {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .date-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      align-self: flex-start;
      padding: 4px 10px;
      border-radius: 999px;
      background: var(--msgbtn-bg);
      border: 1px solid rgba(232, 162, 61, 0.3);
      color: var(--amber-text);
      font-size: 11px;
      font-weight: 700;
    }

    .intro-text {
      font-size: 13px;
      line-height: 1.55;
      color: var(--ink);
      margin: 0;
    }

    .policy-card {
      background-color: var(--bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: border-color 0.2s ease;

      &.highlight-card {
        background-color: var(--msgbtn-bg);
        border-color: rgba(232, 162, 61, 0.4);

        .num-bubble {
          background-color: var(--amber);
          color: var(--on-amber);
        }
      }
    }

    .card-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .num-bubble {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background-color: var(--input);
      color: var(--amber-text);
      font-size: 11px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .card-title {
      font-size: 14px;
      font-weight: 800;
      color: var(--ink);
      margin: 0;
    }

    .card-text {
      font-size: 12.5px;
      line-height: 1.55;
      color: var(--ink);
      margin: 0;
    }

    .card-subtext {
      font-size: 11.5px;
      line-height: 1.45;
      color: var(--muted);
      margin: 0;
    }

    .policy-list {
      margin: 0;
      padding-left: 18px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12.5px;
      line-height: 1.5;
      color: var(--ink);

      li {
        padding-left: 2px;
      }

      strong {
        color: var(--ink);
      }
    }

    .email-box {
      background-color: var(--card);
      border: 1.5px dashed var(--border);
      border-radius: 12px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .email-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .email-link {
      font-size: 13.5px;
      font-weight: 800;
      color: var(--amber-text);
      text-decoration: none;
      word-break: break-all;

      &:hover {
        text-decoration: underline;
      }
    }

    .privacy-foot {
      margin-top: 8px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 12px;
      text-align: center;
    }

    .foot-text {
      font-size: 12px;
      line-height: 1.5;
      color: var(--muted);
      margin: 0;
    }

    .foot-link {
      color: var(--amber-text);
      font-weight: 700;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    .foot-nav {
      margin-top: 4px;
    }

    .brand-link {
      display: inline-block;
      font-size: 12.5px;
      font-weight: 800;
      color: var(--amber-text);
      text-decoration: none;
      padding: 6px 12px;
      border-radius: 8px;
      transition: background-color 0.15s ease;

      &:hover {
        background-color: var(--hover);
        text-decoration: underline;
      }
    }
  `],
})
export class PrivacyComponent {
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  goBack(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else if (this.authService.isAuthenticated()) {
      this.router.navigate(['/chats']);
    } else {
      this.router.navigate(['/login']);
    }
  }
}
