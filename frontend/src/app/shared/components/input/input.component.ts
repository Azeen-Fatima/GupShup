import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="input-field" [class.has-error]="errorMessage()">
      @if (label()) {
        <label [for]="id()" class="field-label">{{ label() }}</label>
      }
      <div class="input-wrapper">
        <input
          [id]="id()"
          [type]="type()"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          [value]="value()"
          [attr.autocomplete]="autocomplete()"
          [attr.aria-invalid]="!!errorMessage()"
          [attr.aria-describedby]="errorMessage() ? id() + '-error' : null"
          (input)="onInputChange($event)"
          (blur)="onBlur()"
          class="custom-input"
        />
      </div>
      @if (errorMessage()) {
        <p [id]="id() + '-error'" class="error-text" role="alert">{{ errorMessage() }}</p>
      }
      @if (hint()) {
        <p class="hint-text">{{ hint() }}</p>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .input-field {
      display: flex;
      flex-direction: column;
      margin-bottom: 13px;
      width: 100%;
    }

    .field-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      margin-bottom: 5px;
      display: block;
    }

    .input-wrapper {
      position: relative;
      width: 100%;
    }

    .custom-input {
      width: 100%;
      padding: 11px 14px;
      border-radius: 12px;
      border: 1.5px solid var(--border);
      background-color: var(--input);
      font-size: 13.5px;
      color: var(--ink);
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.3s ease;

      &::placeholder {
        color: var(--muted);
        opacity: 0.65;
      }

      &:focus,
      &:focus-visible {
        outline: none !important;
        border-color: var(--amber) !important;
        box-shadow: 0 0 0 3px rgba(232, 162, 61, 0.22) !important;
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .has-error .custom-input {
      border-color: var(--danger);
    }

    .error-text {
      font-size: 11.5px;
      color: var(--danger);
      margin-top: 4px;
      font-weight: 600;
    }

    .hint-text {
      font-size: 11.5px;
      color: var(--muted);
      margin-top: 4px;
    }
  `],
})
export class InputComponent implements ControlValueAccessor {
  readonly id = input<string>(`input-${Math.random().toString(36).substring(2, 9)}`);
  readonly label = input<string>('');
  readonly type = input<string>('text');
  readonly placeholder = input<string>('');
  readonly errorMessage = input<string | null>(null);
  readonly hint = input<string | null>(null);
  readonly autocomplete = input<string>('off');

  readonly value = signal<string>('');
  readonly disabled = signal<boolean>(false);

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(val: string): void {
    this.value.set(val || '');
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.value.set(input.value);
    this.onChange(input.value);
  }

  onBlur(): void {
    this.onTouched();
  }
}
