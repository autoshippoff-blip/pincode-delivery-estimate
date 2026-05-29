/**
 * Generates the stylesheet for the Delivery ETA widget.
 * Styles are isolated inside the Shadow Root container to prevent leakage.
 */
export const getStyles = (theme: 'light' | 'dark') => {
  return `
    :host {
      display: block;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      max-width: 100%;
      width: 320px;
      box-sizing: border-box;
      
      /* Harmonious Palette & Variables */
      --eta-bg: ${theme === 'dark' ? '#1f2937' : '#ffffff'};
      --eta-text: ${theme === 'dark' ? '#f9fafb' : '#1f2937'};
      --eta-text-muted: ${theme === 'dark' ? '#9ca3af' : '#6b7280'};
      --eta-border: ${theme === 'dark' ? '#374151' : '#e5e7eb'};
      --eta-border-focus: #3b82f6;
      --eta-primary: #3b82f6;
      --eta-primary-hover: #2563eb;
      --eta-success: #10b981;
      --eta-error: #ef4444;
      --eta-input-bg: ${theme === 'dark' ? '#111827' : '#f9fafb'};
    }

    * {
      box-sizing: border-box;
    }
    
    .eta-widget-container {
      background: var(--eta-bg);
      color: var(--eta-text);
      border: 1px solid var(--eta-border);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .eta-widget-container:hover {
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.08);
      border-color: ${theme === 'dark' ? '#4b5563' : '#d1d5db'};
    }
    
    .eta-widget-title {
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 12px;
      color: var(--eta-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.07em;
    }
    
    .eta-widget-form {
      display: flex;
      gap: 8px;
      margin: 0;
      padding: 0;
    }
    
    .eta-widget-input {
      flex: 1;
      border: 1.5px solid var(--eta-border);
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 14px;
      background: var(--eta-input-bg);
      color: var(--eta-text);
      outline: none;
      transition: all 0.15s ease-in-out;
    }
    
    .eta-widget-input:focus {
      border-color: var(--eta-border-focus);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
      background: var(--eta-bg);
    }
    
    .eta-widget-button {
      background: var(--eta-primary);
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease-in-out;
    }
    
    .eta-widget-button:hover {
      background: var(--eta-primary-hover);
      transform: translateY(-1px);
    }
    
    .eta-widget-button:active {
      transform: translateY(0);
    }
    
    .eta-widget-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    
    .eta-widget-message {
      margin-top: 12px;
      font-size: 13px;
      font-weight: 600;
      min-height: 20px;
      display: flex;
      align-items: center;
      gap: 6px;
      animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    .status-loading {
      color: var(--eta-text-muted);
      animation: pulse 1.5s infinite ease-in-out;
    }
    
    .status-success {
      color: var(--eta-success);
    }
    
    .status-error {
      color: var(--eta-error);
    }
    
    .status-validation {
      color: var(--eta-error);
    }
    
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
  `;
};
