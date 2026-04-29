import { validationLogic } from "../utils/validationLogic";

export const required = <T>(field: keyof T, message: string) => ({
  test: (values: T) => !validationLogic.isEmpty(String(values[field] ?? "")),
  message,
});

export const email = <T>(field: keyof T, message: string) => ({
  test: (values: T) => validationLogic.isEmail(String(values[field] ?? "")),
  message,
});

export const strongPassword = <T>(field: keyof T, message: string) => ({
  test: (values: T) =>
    validationLogic.isStrongPassword(String(values[field] ?? "")),
  message,
});

export const matchField = <T>(
  field: keyof T,
  matchWith: keyof T,
  message: string,
) => ({
  test: (values: T) => values[field] === values[matchWith],
  message,
});