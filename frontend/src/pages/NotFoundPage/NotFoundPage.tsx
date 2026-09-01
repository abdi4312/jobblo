import Lottie from 'lottie-react';
import notFoundAnimation from '../../assets/animations/Page Not Found 404.json';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="max-w-xl text-center">
        <div className="mx-auto h-full w-full">
          <Lottie animationData={notFoundAnimation} loop autoplay />
        </div>
        <h1 className="text-2xl font-bold text-custom-black">Siden finnes ikke</h1>
        <p className="mt-2 text-base text-gray-500">
          Siden du leter etter er flyttet eller finnes ikke lenger.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="rounded-2xl bg-custom-green px-6 py-3 font-bold text-white! transition-colors hover:bg-[#1E5230]"
          >
            Til forsiden
          </Link>
          <Link
            to="/home"
            className="rounded-2xl border border-black/15 px-6 py-3 font-bold text-custom-black! transition-colors hover:bg-gray-50"
          >
            Se alle oppdrag
          </Link>
        </div>
      </div>
    </main>
  );
}
