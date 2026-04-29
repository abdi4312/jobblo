/**
 * validationLogic.ts
 * Provides common validation rules for the application.
 */

export const validationLogic = {
  isEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  },

  isStrongPassword: (password: string): boolean => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    return (
      password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumber
    );
  },

  isValidPhone: (phone: string): boolean => {
    const phoneRegex = /^[0-9]{8}$/;
    return phoneRegex.test(phone.trim());
  },

  isEmpty: (value: string): boolean => {
    return !value || value.trim().length === 0;
  },

  isPositiveNumber: (value: number | string): boolean => {
    const num = typeof value === "string" ? Number(value) : value;
    return !Number.isNaN(num) && num > 0;
  },
};