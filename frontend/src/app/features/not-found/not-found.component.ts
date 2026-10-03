import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, ButtonComponent, EmptyStateComponent],
  template: `
    <div class="not-found-screen">
      <div class="not-found-body">
        <app-empty-state
          type="404"
          title="404 · Page Not Found"
          subtitle="Oops! Looks like this page wandered off somewhere quiet."
        >
          <div style="margin-top: 18px;">
            <app-button variant="primary" routerLink="/chats">
              Back to Chats
            </app-button>
          </div>
        </app-empty-state>
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

    .not-found-screen {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 24px;
      background-color: var(--card);
    }

    .not-found-body {
      margin-block: auto;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
  `],
})
export class NotFoundComponent {}
