import styles from './ChipGroup.module.css';

interface ChipGroupProps {
  chips: string[];
  onChipRemove: (chip: string) => void;
}

export function ChipGroup({ chips, onChipRemove }: ChipGroupProps) {
  return (
    <div className={styles.container}>
      {chips.map((chip) => (
        <div key={chip} className={styles.chipWrapper}>
          <div className={styles.chip}>
            <div className={styles.stateLayer}>
              <div className={styles.labelText}>
                <span>{chip}</span>
              </div>
              <button
                className={styles.closeButton}
                onClick={() => onChipRemove(chip)}
                aria-label={`Remove ${chip}`}
              >
                <svg
                  className={styles.closeIcon}
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4.8 14.6309L3.75 13.5809L7.95 9.38086L3.75 5.18086L4.8 4.13086L9 8.33086L13.2 4.13086L14.25 5.18086L10.05 9.38086L14.25 13.5809L13.2 14.6309L9 10.4309L4.8 14.6309Z"
                    fill="#3A4B3A"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
