import { useMutation } from '@tanstack/react-query';
import { changePasswordSendOtp, changePasswordVerifyOtp } from '../services/auth.service';

export function useChangePasswordSendOtp() {
  return useMutation({ mutationFn: (currentPassword: string) => changePasswordSendOtp(currentPassword) });
}

export function useChangePasswordVerifyOtp() {
  return useMutation({ mutationFn: ({ otp, newPassword }: { otp: string; newPassword: string }) => changePasswordVerifyOtp(otp, newPassword) });
}