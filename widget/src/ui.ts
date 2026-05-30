import { WidgetState } from './types';

export interface WidgetElements {
  container: HTMLDivElement;
  form: HTMLFormElement;
  input: HTMLInputElement;
  button: HTMLButtonElement;
  messageArea: HTMLDivElement;
}

/**
 * Creates the DOM elements for the widget tree.
 * Uses document.createElement and textContent to prevent XSS.
 */
export function createWidgetUI(): WidgetElements {
  const container = document.createElement('div');
  container.className = 'eta-widget-container';

  const title = document.createElement('div');
  title.className = 'eta-widget-title';
  title.textContent = 'Delivery Estimate';

  const form = document.createElement('form');
  form.className = 'eta-widget-form';
  // Prevent browser default submissions
  form.addEventListener('submit', (e) => e.preventDefault());

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Enter 6-digit Pincode';
  input.className = 'eta-widget-input';
  input.maxLength = 6;
  input.inputMode = 'numeric'; // Show number pad on mobile

  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'eta-widget-button';
  button.textContent = 'Check';

  form.appendChild(input);
  form.appendChild(button);

  const messageArea = document.createElement('div');
  messageArea.className = 'eta-widget-message';

  container.appendChild(title);
  container.appendChild(form);
  container.appendChild(messageArea);

  return { container, form, input, button, messageArea };
}

/**
 * Updates the DOM elements dynamically based on the current state.
 */
export function updateUI(elements: WidgetElements, state: WidgetState): void {
  // Sync input value
  if (elements.input.value !== state.pincode) {
    elements.input.value = state.pincode;
  }

  // Reset message area class
  elements.messageArea.className = 'eta-widget-message';
  elements.messageArea.textContent = '';

  switch (state.status) {
    case 'idle':
      elements.input.disabled = false;
      elements.button.disabled = false;
      elements.button.textContent = 'Check';
      break;

    case 'loading':
      elements.input.disabled = true;
      elements.button.disabled = true;
      elements.messageArea.textContent = 'Checking delivery...';
      elements.messageArea.classList.add('status-loading');
      break;

    case 'success':
      elements.input.disabled = false;
      elements.button.disabled = false;
      
      const etaText = document.createElement('span');
      etaText.textContent = `✓ Delivery in ${state.deliveryDays}`;
      elements.messageArea.appendChild(etaText);

      if (state.codAvailable !== undefined) {
        const badge = document.createElement('span');
        badge.className = state.codAvailable
          ? 'eta-widget-badge status-cod-active'
          : 'eta-widget-badge status-cod-blocked';
        badge.textContent = state.codAvailable
          ? '✓ Cash on Delivery available'
          : '⚡ Prepaid Orders Only';
        elements.messageArea.appendChild(badge);
      }

      elements.messageArea.classList.add('status-success');
      break;

    case 'error':
      elements.input.disabled = false;
      elements.button.disabled = false;
      elements.messageArea.textContent = state.errorMessage || '✕ Pincode not serviceable';
      elements.messageArea.classList.add('status-error');
      break;

    case 'validation':
      elements.input.disabled = false;
      elements.button.disabled = false;
      elements.messageArea.textContent =
        state.validationMessage || 'Please enter a valid 6-digit pincode';
      elements.messageArea.classList.add('status-validation');
      break;
  }
}
