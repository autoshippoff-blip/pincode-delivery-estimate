import { loadConfig } from './config';
import { ApiClient } from './api';
import { isValidPincode, sanitizeInput } from './validator';
import { getStyles } from './styles';
import { createWidgetUI, updateUI } from './ui';
import { WidgetState } from './types';

class DeliveryEtaWidget {
  private state: WidgetState = {
    status: 'idle',
    pincode: '',
  };

  private elements!: ReturnType<typeof createWidgetUI>;
  private apiClient!: ApiClient;

  constructor() {
    this.init();
  }

  private init() {
    try {
      // 1. Load configuration from document.currentScript attributes
      const config = loadConfig();

      this.apiClient = new ApiClient({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
      });

      // 2. Define lazy-mounting logic to handle elements rendered asynchronously
      let mounted = false;
      const mountWidget = (): boolean => {
        if (mounted) return true;

        const mountNode = document.getElementById(config.mountId);
        if (!mountNode) {
          return false;
        }

        // Attach browser-native Shadow DOM to seal styling boundaries
        const shadow = mountNode.attachShadow({ mode: 'open' });

        // Inject scoped light/dark stylesheet
        const styleSheet = document.createElement('style');
        styleSheet.textContent = getStyles(config.theme);
        shadow.appendChild(styleSheet);

        // Instantiate secure DOM elements
        this.elements = createWidgetUI();
        shadow.appendChild(this.elements.container);

        // Bind events and render initial state
        this.bindEvents();
        this.setState({ status: 'idle', pincode: '' });

        mounted = true;
        return true;
      };

      // 3. Mount immediately or listen to document lifecycle triggers
      if (!mountWidget()) {
        const handleDomReady = () => {
          if (!mountWidget()) {
            // Fallback: Poll periodically in case of slow template injects (e.g. Shopify page loads)
            const intervalId = setInterval(() => {
              if (mountWidget()) {
                clearInterval(intervalId);
              }
            }, 250);

            // Cancel polling after 10 seconds to avoid memory bloat
            setTimeout(() => clearInterval(intervalId), 10000);
          }
        };

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', handleDomReady);
        } else {
          handleDomReady();
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Failed to initialize Delivery ETA Widget:', error.message);
    }
  }

  private setState(newState: Partial<WidgetState>) {
    this.state = { ...this.state, ...newState };
    updateUI(this.elements, this.state);
  }

  private bindEvents() {
    const { input, form } = this.elements;

    // Sanitize keystrokes dynamically on user input
    input.addEventListener('input', () => {
      const sanitized = sanitizeInput(input.value);
      this.setState({ pincode: sanitized });
    });

    // Handle verification submits
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const pincode = this.state.pincode.trim();

      // Validate input format
      if (!isValidPincode(pincode)) {
        this.setState({
          status: 'validation',
          validationMessage: 'Please enter a valid 6-digit pincode',
        });
        return;
      }

      // Enter loading state
      this.setState({ status: 'loading', pincode });

      try {
        const response = await this.apiClient.checkPincode(pincode);

        if (response.success && response.serviceable) {
          this.setState({
            status: 'success',
            deliveryDays: response.estimated_delivery,
            codAvailable: response.cod_available,
          });
        } else {
          this.setState({
            status: 'error',
            errorMessage: '✕ Pincode not serviceable',
          });
        }
      } catch (err: unknown) {
        const error = err as Error;
        console.warn(`Delivery ETA widget lookup failed: ${error.message}`);

        if (error.message === 'HTTP_404') {
          // Pincode is not in database (not serviceable)
          this.setState({
            status: 'error',
            errorMessage: '✕ Pincode not serviceable',
          });
        } else {
          // System error (e.g. 401 suspend, 500 crash, Timeout, or connection drops)
          this.setState({
            status: 'error',
            errorMessage: 'Unable to check delivery right now. Please try again.',
          });
        }
      }
    });
  }
}

// Auto-run instantiation on load
new DeliveryEtaWidget();
