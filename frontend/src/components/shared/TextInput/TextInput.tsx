import styles from './TextInput.module.css';

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
}

export function TextInput({ 
  label, 
  value, 
  onChange, 
  placeholder = "", 
  multiline = false, 
  disabled = false 
}: TextInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const inputProps = {
    className: styles.input,
    value,
    onChange: handleChange,
    placeholder,
    disabled
  };

  return (
    <div className={`${styles.container} ${multiline ? styles.multiline : ''}`}>
      <div className={styles.inputWrapper}>
        <div className={styles.stateLayer}>
          <div className={styles.content}>
            <div className={styles.inputContainer}>
              {multiline ? (
                <textarea {...inputProps} rows={4} />
              ) : (
                <input {...inputProps} type="text" />
              )}
            </div>
            <div className={styles.labelContainer}>
              <div className={styles.labelText}>
                <span>{label}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
