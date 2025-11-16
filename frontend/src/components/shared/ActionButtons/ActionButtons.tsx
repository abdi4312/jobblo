import styles from './ActionButtons.module.css';

interface ActionButtonsProps {
  onPreview: () => void;
  onPublish: () => void;
  onDelete: () => void;
}

export function ActionButtons({ onPreview, onPublish, onDelete }: ActionButtonsProps) {
  return (
    <div className={styles.container}>
      <div className={styles.topButtonsRow}>
        <button className={styles.previewButton} onClick={onPreview}>
          <div className={styles.previewButtonContent}>
            <div className={styles.previewButtonStateLayer}>
              <div className={styles.previewButtonLabel}>
                Forhåndsvis
              </div>
            </div>
          </div>
        </button>
        
        <button className={styles.publishButton} onClick={onPublish}>
          <div className={styles.publishButtonContent}>
            <div className={styles.publishButtonStateLayer}>
              <div className={styles.publishButtonLabel}>
                Publiser
              </div>
            </div>
          </div>
        </button>
      </div>
      
      <div className={styles.bottomButtonRow}>
        <button className={styles.deleteButton} onClick={onDelete}>
          <div className={styles.deleteButtonContent}>
            <div className={styles.deleteButtonStateLayer}>
              <div className={styles.deleteButtonLabel}>
                Slett Oppdrag
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
