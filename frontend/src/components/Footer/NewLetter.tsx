import { Mail } from "lucide-react";
import FooterImg from "../../assets/images/Footer/footer-img.png";
import TopographicImg from "../../assets/images/Footer/Topographic-2.png";
import { Button } from "../Ui/Button";
import { Input } from "../Ui/Input";


export default function NewLetter() {
    return (
        <div className="flex w-full md:max-w-330 mx-auto relative">

            {/* <div className="flex justify-center"> */}
            <div className="flex lg:gap-29 w-full">
                <div className="flex items-center justify-center text-center">
                    <img src={FooterImg} alt="" className="lg:max-w-118.5 lg:max-h-53.75 xl:max-w-127.5 xl:max-h-63.75 hidden lg:block" />
                </div>

                {/* <div className="relative bg-[#0E2A22] p-8 pt-10.5 w-full text-center"> */}
                <div className="bg-[#0E2A22] pl-8 pt-10.5 w-full lg:flex lg:justify-between">

                    <div>
                        <div className="text-white max-w-75 sm:max-w-125 md:max-w-auto mx-auto">

                            <h3 className="text-[24px] font-medium mb-2">
                                Hold deg oppdatert
                            </h3>

                            <p className="text-[12px] sm:text-[14px] md:text-base font-normal mb-5">
                                Få de nyeste oppdragene og tips rett i innboksen din.
                            </p>

                            {/* <form className="flex gap-3 flex-wrap justify-center p-0!"> */}
                            <form className="flex gap-3 p-0!">

                                <div className="flex gap-3 flex-col md:flex-row justify-center items-center w-full">
                                    <Input placeholder="E-post" icon={<Mail size={20} className="text-[#9E9E9E]" />} containerClassName="max-w-[300px] sm:max-w-[500px] md:min-w-75 text-[#000000]" />
                                    <Button label="Abonner" size="lg" className="max-w-23.75" />
                                </div>

                            </form>

                        </div>

                        {/* <div className="text-white gap-3 pt-8 text-center"> */}
                        <div className="text-white gap-3 pt-8 max-w-75 sm:max-w-125 md:max-w-auto mx-auto text-center lg:text-start">

                            <div className="border border-[#FFFFFF4D]"></div>

                            <p className="text-[12px] sm:text-[14px] font-normal pt-3">
                                <span>© 2026 Jobblo. Alle rettigheter reservert.</span>
                            </p>

                            <div>
                                {/* <ul className="flex gap-6 text-[14px] justify-center font-normal"> */}
                                <ul className="flex justify-between gap-6 text-[8px] sm:text-[12px] md:text-[14px] font-normal pt-3 pb-5 lg:justify-start">
                                    <li>Personvernerklæring</li>
                                    <li>Brukervilkår</li>
                                    <li>Cookie-innstillinger</li>
                                </ul>
                            </div>

                        </div>
                    </div>
                    <div className="hidden lg:block -mt-35">
                        <img src={TopographicImg} alt="TopographicImg" className="" />
                    </div>
                </div>

            </div>


        </div>
    )
}
