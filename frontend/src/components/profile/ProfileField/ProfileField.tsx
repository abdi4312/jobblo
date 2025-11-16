import styles from './ProfileField.module.css';
import EditIcon from '../../../assets/icons/edit.svg?react';

interface ProfileFieldProps {
  label: string;
  value: string;
  onEdit?: () => void;
}

export function ProfileField({ label, value, onEdit }: ProfileFieldProps) {
  const handleEdit = () => {
    if (onEdit) {
      onEdit();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.fieldInfo}>
          <div className={styles.label}>{label}</div>
          <div className={styles.value}>{value}</div>
        </div>
        <button 
          className={styles.editButton} 
          onClick={handleEdit}
          aria-label={`Edit ${label}`}
        >
          <EditIcon className={styles.editIcon} />
        </button>
      </div>
      <div className={styles.divider}></div>
    </div>
  );
}
