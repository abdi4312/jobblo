import styles from "./Footer.module.css";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className={styles.container}>
      <p className={styles.title}>Jobblo</p>
      <Link to="/om-oss">Om oss</Link>
      <Link to="/tjenester">Tjenester</Link>
      <Link to="/team">Vårt team</Link>
      <Link to="/support">Support</Link>
      <Link to="/annonseregler">Annonseregler</Link>
    </footer>
  );
}
