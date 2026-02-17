import CtaBanner from "../../Footer/CtaBanner";
import Content from "../../Footer/Content";
import NewLetter from "../../Footer/NewLetter";


const Footer = () => {
  return (
    <>
      <div className="w-full bg-[#2F7E47] relative pt-5 mt-20">

        {/* CTA Banner */}
        <CtaBanner />

        {/* Main Footer Content */}
        <div className="relative max-w-300 mx-auto px-6 lg:px-8 pt-25">
          <Content />
          {/* Newsletter Section */}
        </div>

        {/* <div className="flex max-w-[1300px] mx-auto max-h-[271px] overflow-hidden"> */}
          <NewLetter />

      </div>
    </>

  );
};

export default Footer;
