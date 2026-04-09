export default function SocialAuthButtons() {
  const handleGoogle = () => {
    window.location.href = `${import.meta.env.VITE_MAIN_URL}/api/auth/google`;
  };

  const handleVipps = () => {
    window.location.href = `${import.meta.env.VITE_MAIN_URL}/api/auth/vipps`;
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Google Button */}
      <button
        onClick={handleGoogle}
        className="flex items-center justify-center gap-[10px] h-12 rounded-lg border border-[#2d2d2d] bg-[#1f1f1f] text-white text-[15px] font-medium cursor-pointer transition-all duration-200 ease-in-out hover:bg-[#2a2a2a]"
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <g clipPath="url(#clip0_643_9687)">
            <path d="M8.00018 3.16667C9.18018 3.16667 10.2368 3.57333 11.0702 4.36667L13.3535 2.08333C11.9668 0.793333 10.1568 0 8.00018 0C4.87352 0 2.17018 1.79333 0.853516 4.40667L3.51352 6.47C4.14352 4.57333 5.91352 3.16667 8.00018 3.16667Z" fill="#EA4335" />
            <path d="M15.66 8.18335C15.66 7.66002 15.61 7.15335 15.5333 6.66669H8V9.67335H12.3133C12.12 10.66 11.56 11.5 10.72 12.0667L13.2967 14.0667C14.8 12.6734 15.66 10.6134 15.66 8.18335Z" fill="#4285F4" />
            <path d="M3.51 9.53001C3.35 9.04668 3.25667 8.53334 3.25667 8.00001C3.25667 7.46668 3.34667 6.95334 3.51 6.47001L0.85 4.40668C0.306667 5.48668 0 6.70668 0 8.00001C0 9.29334 0.306667 10.5133 0.853333 11.5933L3.51 9.53001Z" fill="#FBBC05" />
            <path d="M8.0001 16C10.1601 16 11.9768 15.29 13.2968 14.0633L10.7201 12.0633C10.0034 12.5467 9.0801 12.83 8.0001 12.83C5.91343 12.83 4.14343 11.4233 3.5101 9.52667L0.850098 11.59C2.1701 14.2067 4.87343 16 8.0001 16Z" fill="#34A853" />
          </g>
          <defs>
            <clipPath id="clip0_643_9687">
              <rect width="16" height="16" fill="white" />
            </clipPath>
          </defs>
        </svg>
        <span>Continue with Google</span>
      </button>

      {/* Apple Button */}
      {/* <button
        onClick={handleVipps}
        className="flex items-center justify-center gap-[10px] h-12 rounded-lg border border-[#2d2d2d] bg-[#1f1f1f] text-white text-[15px] font-medium cursor-pointer transition-all duration-200 ease-in-out hover:bg-[#2a2a2a]"
      > */}
        {/* <span className="text-[20px] -mt-[2px]"> */}
          {/* <img className="w-[18px] h-[18px]" alt="vipps mobilepay logo" src={vippsLogo}></img> */}
        {/* </span>
        <span>Continue with Apple</span>
      </button> */}

      {/* Vipps Button */}
      <button
        onClick={handleVipps}
        className="flex items-center justify-center gap-[10px] h-12 rounded-lg border border-[#2d2d2d] bg-[#1f1f1f] text-white text-[15px] font-medium cursor-pointer transition-all duration-200 ease-in-out hover:bg-[#2a2a2a]"
      >
        <span className="text-[20px] -mt-[2px]">
          {/* <img className="w-[18px] h-[18px]" alt="vipps mobilepay logo" src={vippsLogo}></img> */}
        </span>
        <span>Continue with Vipps</span>
      </button>
    </div>
  );
}
