import styles from "./Testimonials.module.css";
import { Divider } from "antd";

export function Testimonials() {
  return (
    <>
      <div className={styles.testimonialsContainer}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <p className={styles.title}>Hva andre sier om oss</p>
          <div className={styles.testimonialItemRight}>
            <p className={styles.text}>
              Jobblo har bistått oss med å flytte kontor gjentatte ganger med
              dyktige arbeidere som er kvalitet sjekket
            </p>
            <img src="src/assets/images/testimonial2.png" alt="obos logo" />
          </div>
          <Divider style={{}} />
          <div className={styles.testimonialItemLeft}>
            <img src="src/assets/images/testimonial1.png" alt="obos logo" />

            <p className={styles.text}>
            Jeg har endelig fått jobb og tjener penger ved bruk av jobblo
          </p>
        </div>
        </div>
      </div>
    </>
  );
}
