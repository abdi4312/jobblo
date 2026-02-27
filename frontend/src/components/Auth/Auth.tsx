import LoginImg from "../../assets/images/Login/loginnstandard-img.png";
import Logo from "../../assets/images/Login/jobblo-logo.png";
import { ArrowLeft } from "lucide-react";
import {  useNavigate } from "react-router-dom";

export default function Auth() {
    const navigate = useNavigate();
    const list = [
        { number: "5000+", name: "Aktive oppdrag" },
        { number: "15k+", name: "Brukere" },
        { number: "4.8★", name: "Vurdering" }
    ];
    return (
        <>
            <div>
                <img src={LoginImg} alt="Login_img" className="w-full h-full object-cover absolute inset-0" />
            </div>

            <div className="flex flex-col justify-between absolute inset-0 p-[40px] text-white z-10">
                <div className="flex flex-col gap-5">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(-1)}>
                        <span><ArrowLeft size={20} /></span>
                        <p>Tilbake</p>
                    </div>
                    <div>
                        <img src={Logo} alt="Logo" className="max-w-[151px] max-h-[54px]" />
                    </div>
                </div>

                <div className="flex flex-col gap-8">
                    <div>
                        <h1 className="text-[48px] font-bold leading-15">Små jobber.</h1>
                        <h1 className="text-[48px] font-bold text-[#E08835] leading-15">Store muligheter.</h1>
                    </div>

                    <div className="max-w-97.25">
                        <p className="text-[20px] font-normal">
                            Bli med Norges ledende plattform for lokale oppdrag og fleksibelt arbeid
                        </p>
                    </div>

                    <div className="flex gap-5 justify-between max-w-[485px]">
                        {list.map((item, index) => (
                            <div key={index} className="flex flex-col items-center">
                                <p className="text-[30px] font-bold text-[#FFFFFF]">{item.number}</p>
                                <p className="text-[14px] font-normal text-[#FFFFFF]">{item.name}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <p className="font-normal text-base leading-5">"Jobblo har gjort det så enkelt å finne oppdrag i nærområdet mitt"</p>
                    <p className="font-normal text-[14px] leading-5">— Maria, Oslo</p>
                </div>

            </div>
        </>
    )
}
