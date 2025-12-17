import { Category } from "../../component/category/Category.tsx";
import styles from "./Categories.module.css";
import { getCategories } from "../../../api/categoryAPI.ts";
import { useEffect, useState } from "react";
import type { CategoryType } from "../../../types/categoryTypes.ts";

export function Categories() {
  const [category, setCategory] = useState<CategoryType[]>([]);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const data = await getCategories();
        setCategory(data);
      } catch (err) {
        console.error("Failed to catch categories", err);
      }
    }

    void fetchCategories();
  }, []);

  return (
    <>
      <div className={styles.categoriesContainer}>
        <h2>Kategorier</h2>
        <div className={styles.categoryContainer}>
          {category.map((item) => (
            <Category
              category={item.name}
              categoryIcon={item.slug}
              key={item._id}
            />
          ))}
        </div>
      </div>
    </>
  );
}
