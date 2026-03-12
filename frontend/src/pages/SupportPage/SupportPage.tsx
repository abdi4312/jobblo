import { useEffect } from "react";
import Header from "../../components/Support/Header"
import CategoryCard from "../../components/Support/CategoryCard";
import FAQItem from "../../components/Support/FAQItem";
import Contact from "../../components/Support/Contact";

export default function SupportPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <div className="-mt-6 md:-mt-16">
        <Header />

        <CategoryCard />

        <FAQItem />

        <Contact />
      </div>
    </>
  );
}
