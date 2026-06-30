import LoginImgL from '../../assets/images/Login/left.png';
import LoginImgR from '../../assets/images/Login/right.png';
import LogoBG from '../../assets/images/Login/loginpage-bg.png';
import LogoHande from '../../assets/images/Login/login-hande.png';

export default function Auth() {
  return (
    <div className="w-full h-full p-4 flex items-center justify-center select-none">
      <div className="relative w-full h-full rounded-[36px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.12)] border border-white/20 flex items-center justify-center bg-[#eae4d9]">
        {/* Background Image */}
        <img
          src={LogoBG}
          alt="Background"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        {/* Hand Illustration */}
        <img
          src={LogoHande}
          alt="Hand illustration"
          className="absolute w-[200px] right-0 top-0 max-w-[200px] object-contain pointer-events-none z-30"
        />

        {/* Phone Mockups Wrapper */}
        <div className="absolute inset-x-0 top-18 bottom-0 flex items-start justify-center overflow-hidden">
          <div className="relative w-full h-full mx-auto flex items-start justify-center pt-[10%]">
            {/* Left Phone Mockup */}
            <div className="w-[39%] h-[84%] relative z-10">
              <img
                src={LoginImgL}
                alt="Jobblo Left Phone"
                className="w-full h-full object-contain object-top pointer-events-none filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.12)]"
              />
            </div>

            {/* Right Phone Mockup */}
            <div className="w-[39%] h-[84%] pt-10 relative z-20">
              <img
                src={LoginImgR}
                alt="Jobblo Right Phone"
                className="w-full h-full object-contain object-top"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
