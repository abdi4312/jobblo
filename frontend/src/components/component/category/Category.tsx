import styles from "./Category.module.css";

export function Category({
  category,
  categoryIcon,
}: {
  category: string;
  categoryIcon: React.ReactNode;
}) {
  return (
    <>
      <div className={styles.categoryContainer}>
        <div className={styles.categoryIcon}>
          {categoryIcon}
        </div>
        <h3>{category}</h3>
      </div>
    </>
  );
}
