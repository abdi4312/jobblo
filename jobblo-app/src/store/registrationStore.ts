import { create } from 'zustand';

export type RegistrationFormData = {
  name: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  role: 'user' | 'company';
  companyName?: string;
  orgNumber?: string;
};

type RegistrationState = {
  formData: RegistrationFormData;
  setFormData: (data: Partial<RegistrationFormData>) => void;
  reset: () => void;
};

const initialState: RegistrationFormData = {
  name: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  acceptedTerms: false,
  role: 'user',
  companyName: '',
  orgNumber: '',
};

export const useRegistrationStore = create<RegistrationState>((set) => ({
  formData: initialState,
  setFormData: (data) =>
    set((state) => ({
      formData: { ...state.formData, ...data },
    })),
  reset: () => set({ formData: initialState }),
}));
