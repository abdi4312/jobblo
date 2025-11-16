import styles from "./Category.module.css";

export function Category({
  category,
  categoryIcon,
}: {
  category: string;
  categoryIcon: string;
}) {
  return (
    <>
      <div className={styles.categoryContainer}>
        <span className={`material-symbols-outlined ${styles.categoryIcon}`}>
          {categoryIcon}
        </span>
        <h3>{category}</h3>
      </div>
    </>
  );
}
