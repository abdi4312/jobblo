import Lottie from "lottie-react";
import notFoundAnimation from "../../assets/animations/Page Not Found 404.json";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-xl text-center">
        <div className="mx-auto h-full w-full">
          <Lottie animationData={notFoundAnimation} loop autoplay />
        </div>
      </div>
    </main>
  );
}