import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.container}>
      <p className={styles.title}>Jobblo</p>
      <a href="">Om oss</a>
      <a href="">Tjenester</a>
      <a href="">Vårt team</a>
      <a href="">Support</a>
      <a href="">Annonseregler</a>
    </footer>
  );
}
