/**
 * Validates if the given input is a valid 6-digit numeric Indian pincode.
 */
export function isValidPincode(pincode: string): boolean {
  return /^\d{6}$/.test(pincode.trim());
}
export function sanitizeInput(input: string): string {
  // Allow only digits and limit to 6 characters
  return input.replace(/\D/g, '').slice(0, 6);
}
