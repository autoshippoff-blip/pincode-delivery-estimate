import { WidgetConfig } from './types';

export function loadConfig(): WidgetConfig {
  const currentScript = document.currentScript as HTMLScriptElement;

  if (!currentScript) {
    console.warn(
      'Delivery ETA Widget script tag not found via document.currentScript. Using default configurations.',
    );
    return {
      apiKey: '',
      baseUrl: 'http://localhost:3000',
      mountId: 'eta-widget',
      theme: 'light',
    };
  }

  const apiKey = currentScript.getAttribute('data-api-key') || '';
  const mountId = currentScript.getAttribute('data-mount-id') || 'eta-widget';

  let baseUrl = currentScript.getAttribute('data-base-url');
  if (!baseUrl) {
    try {
      const scriptUrl = new URL(currentScript.src);
      if (scriptUrl.protocol.startsWith('http')) {
        baseUrl = scriptUrl.origin;
      }
    } catch (e) {
      // Ignored, fallback to localhost
    }
  }
  if (!baseUrl) {
    baseUrl = 'http://localhost:3000';
  }

  const themeAttr = currentScript.getAttribute('data-theme');
  const theme = themeAttr === 'dark' ? 'dark' : 'light';

  return { apiKey, baseUrl, mountId, theme };
}
