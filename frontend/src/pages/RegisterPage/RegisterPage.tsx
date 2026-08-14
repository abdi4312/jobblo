import AuthLayout from '../../components/Auth/AuthLayout.tsx';
import { RegisterForm } from '../../components/Auth/RegisterForm.tsx';

export default function RegisterPage() {
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
