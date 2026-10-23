import React from 'react';
import { Text, TouchableOpacity } from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  onPress?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  small?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  onPress,
  disabled = false,
  icon,
  fullWidth = false,
  small = false,
}: ButtonProps) {
  const variantClass =
    variant === 'primary'
      ? 'bg-brand'
      : variant === 'secondary'
        ? 'bg-surface border border-line'
        : 'bg-transparent';

  const labelClass =
    variant === 'primary'
      ? 'text-white'
      : variant === 'secondary'
        ? 'text-ink'
        : 'text-muted';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      className={[
        'flex-row items-center justify-center rounded-full',
        variantClass,
        fullWidth ? 'w-full' : '',
        small ? 'px-3 py-2' : 'px-4 py-3',
        disabled ? 'opacity-60' : '',
      ].join(' ')}
    >
      {icon ? <React.Fragment>{icon}</React.Fragment> : null}
      <Text className={['text-[0.875rem] font-semibold', labelClass].join(' ')}>{label}</Text>
    </TouchableOpacity>
  );
}
