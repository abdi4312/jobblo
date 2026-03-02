import CtaBanner from "../../Footer/CtaBanner";
import Content from "../../Footer/Content";
import NewLetter from "../../Footer/NewLetter";


const Footer = () => {
  return (
    <>
      <div className="lg:relative lg:mt-20">
        <div className="mb-2.5 lg:absolute -top-22.5 left-0 right-0">
          <CtaBanner />
        </div>
        <div className="w-full bg-[#2F7E47] pt-5">

          {/* Main Footer Content */}
          <div className="relative max-w-300 mx-auto px-6 lg:px-8 md:pt-25">
            <Content />
          </div>

          <NewLetter />

        </div>
      </div>
    </>

  );
};

export default Footer;
