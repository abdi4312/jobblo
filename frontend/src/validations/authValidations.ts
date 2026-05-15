import { required, email, strongPassword, matchField } from "./rules";

export type LoginFormValues = {
  email: string;
  password: string;
};

export type RegisterFormValues = {
  name: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  companyName?: string;
  orgNumber?: string;
};

export const loginValidationSchema = {
  email: [
    required<LoginFormValues>("email", "Vennligst skriv inn e-post"),
    email<LoginFormValues>("email", "Vennligst skriv inn en gyldig e-post"),
  ],

  password: [
    required<LoginFormValues>("password", "Vennligst skriv inn passord"),
  ],
};

export const registerValidationSchema = {
  name: [required<RegisterFormValues>("name", "Vennligst skriv inn fornavn")],

  lastName: [
    required<RegisterFormValues>("lastName", "Vennligst skriv inn etternavn"),
  ],

  email: [
    required<RegisterFormValues>("email", "Vennligst skriv inn e-post"),
    email<RegisterFormValues>("email", "Vennligst skriv inn en gyldig e-post"),
  ],

  password: [
    required<RegisterFormValues>("password", "Vennligst skriv inn passord"),
    strongPassword<RegisterFormValues>(
      "password",
      "Passordet må være minst 8 tegn og inneholde stor bokstav, liten bokstav og tall",
    ),
  ],

  confirmPassword: [
    required<RegisterFormValues>(
      "confirmPassword",
      "Vennligst bekreft passord",
    ),
    matchField<RegisterFormValues>(
      "confirmPassword",
      "password",
      "Passordene matcher ikke",
    ),
  ],

  role: [required<RegisterFormValues>("role", "Vennligst velg brukertype")],

  companyName: [
    {
      test: (values: RegisterFormValues) =>
        values.role !== "company" ||
        (!!values.companyName && values.companyName.trim() !== ""),
      message: "Vennligst skriv inn bedriftsnavn",
    },
  ],

  orgNumber: [
    {
      test: (values: RegisterFormValues) =>
        values.role !== "company" || /^\d{9}$/.test(values.orgNumber || ""),
      message: "Organisasjonsnummer må være nøyaktig 9 siffer",
    },
  ],
};
