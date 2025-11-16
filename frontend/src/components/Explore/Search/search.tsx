import styles from "./search.module.css";
import { Button } from "antd";
import jobbloswipe from "../../../assets/images/jobbloswipe.png";

export function Search() {
  return (
    <>
    <div className={styles.searchContainer}>
        <div className={styles.searchActionContainer}>
        <Button
            icon={<span className="material-symbols-outlined">map</span>}
            size={"large"}
            shape={"circle"}
            />
        </div>
        <input style={{ 
            marginLeft: "10px",
            width: "60vw", 
            maxWidth: "600px",
            borderRadius: "10px", 
            border: "2px solid #eee",
            position: "relative",
            paddingLeft: "10px"}} 
            type="text" 
            placeholder="Søk etter oppdrag"
            />

            <span style={{
                right: "30px", 
                position: "relative", 
                paddingTop:"7px"}} 
                className="material-symbols-outlined">
                search
            </span>
    </div>

    <div className={styles.searchButtonContainer}>
        <button style={{color:"white", backgroundColor: "var(--color-primary)"}}>Legg ut Annonse</button>
        <div style={{position:"relative"}}>
        <button style={{color:"white", backgroundColor: "var(--color-accent)"}}>Swipe</button>
        <img style={{width:"28px", height:"14px", position:"absolute", right:"26px", top:"3px"}} src={jobbloswipe} alt="Jobblo swipe" />
        </div>
    </div>

    </>
  );
}
