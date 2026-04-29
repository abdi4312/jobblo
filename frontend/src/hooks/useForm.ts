import { useState, useCallback } from "react";

interface ValidationRule<T> {
  test: (values: T) => boolean;
  message: string;
}

type ValidationSchema<T> = {
  [K in keyof T]?: ValidationRule<T>[];
};

/**
 * A reusable hook for managing form state and validation.
 */
export function useForm<T extends Record<string, unknown>>(
  initialValues: T,
  validationSchema: ValidationSchema<T> = {},
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<{ [K in keyof T]?: string }>({});

  const handleChange = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setValues((prev) => ({
        ...prev,
        [field]: value,
      }));

      setErrors((prev) => {
        if (!prev[field]) return prev;

        return {
          ...prev,
          [field]: "",
        };
      });
    },
    [],
  );

  const validate = useCallback(() => {
    const newErrors: { [K in keyof T]?: string } = {};

    (Object.keys(validationSchema) as Array<keyof T>).forEach((field) => {
      const rules = validationSchema[field];

      if (!rules) return;

      for (const rule of rules) {
        if (!rule.test(values)) {
          newErrors[field] = rule.message;
          break;
        }
      }
    });

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }, [values, validationSchema]);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  return {
    values,
    errors,
    handleChange,
    validate,
    resetForm,
    setValues,
    setErrors,
  };
}