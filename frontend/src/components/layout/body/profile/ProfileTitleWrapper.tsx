import styles from "./ProfileTitleWrapper.module.css";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export function ProfileTitleWrapper({
  title,
  buttonText,
}: {
  title: string;
  buttonText: string;
}) {
  const nav = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <div className={styles.container}>
        <button onClick={() => nav(-1)} className={styles.button}>
          <span className="material-symbols-outlined">arrow_back</span>
          {buttonText}
        </button>
      </div>

      <h2 className={styles.title}>{title}</h2>
    </>
  );
}
