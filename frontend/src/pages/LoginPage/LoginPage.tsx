import AuthLayout from '../../components/Auth/AuthLayout.tsx';
import { LoginForm } from '../../components/Auth/LoginForm.tsx';

export default function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
