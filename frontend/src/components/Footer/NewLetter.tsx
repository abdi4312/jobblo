import { Mail } from "lucide-react";
import FooterImg from "../../assets/images/Footer/footer-img.png";
import TopographicImg from "../../assets/images/Footer/Topographic-2.png";
import { Button } from "../Ui/Button";
import { Input } from "../Ui/Input";


export default function NewLetter() {
    return (
        <div className="flex max-w-330 mx-auto overflow-hidden relative">

            {/* <div className="flex justify-center"> */}
            <div className="flex gap-29">
                <div className="flex items-center justify-center text-center">
                    <img src={FooterImg} alt="" className="max-w-127.5 max-h-63.75" />
                </div>

                {/* <div className="relative bg-[#0E2A22] p-8 pt-10.5 w-full text-center"> */}
                <div className="bg-[#0E2A22] pl-8 pt-10.5 w-full">

                    <div className="text-white">

                        <h3 className="text-[24px] font-medium mb-2">
                            Hold deg oppdatert
                        </h3>

                        <p className="text-base font-normal mb-5">
                            Få de nyeste oppdragene og tips rett i innboksen din.
                        </p>

                        {/* <form className="flex gap-3 flex-wrap justify-center p-0!"> */}
                        <form className="flex gap-3 p-0!">

                            <div className="flex gap-3">
                                <Input placeholder="email" icon={<Mail size={20} className="text-[#9E9E9E]" />} containerClassName="min-w-75 text-[#000000]" />
                                <Button label="Abonner" size="lg" />
                            </div>

                        </form>

                    </div>

                    {/* <div className="text-white gap-3 pt-8 text-center"> */}
                    <div className="text-white gap-3 pt-8">

                        <div className="border"></div>

                        <p className="text-[14px] font-normal pt-3">
                            <span>© 2026 Jobblo. Alle rettigheter reservert.</span>
                        </p>

                        <div>
                            {/* <ul className="flex gap-6 text-[14px] justify-center font-normal"> */}
                            <ul className="flex gap-6 text-[14px] font-normal">
                                <li>Personvernerklæring</li>
                                <li>Brukervilkår</li>
                                <li>Cookie-innstillinger</li>
                            </ul>
                        </div>

                    </div>

                </div>
            </div>

            <div>
                <img src={TopographicImg} alt="TopographicImg" className="bg-[#0E2A22] absolute -top-23" />
            </div>
        </div>
    )
}
