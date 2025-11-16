import { useState } from 'react';
import styles from './DateTimePicker.module.css';

interface DateTimePickerProps {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  onDateChange: (field: string, value: string) => void;
}

export function DateTimePicker({
  startTime,
  endTime,
  onDateChange
}: DateTimePickerProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);


  const handleDatePickerCancel = () => {
    setShowDatePicker(false);
  };

  const handleDatePickerOK = () => {
    setShowDatePicker(false);
  };

  const handleTimeChange = (field: string, value: string) => {
    onDateChange(field, value);
  };

  const clearTime = (field: string) => {
    onDateChange(field, '');
  };

  return (
    <div className={styles.container}>
      {showDatePicker && (
        <div className={styles.datePickerModal}>
          <div className={styles.datePicker}>
            <div className={styles.datePickerHeader}>
              <div className={styles.datePickerDate}>
                <div className={styles.datePickerTitle}>
                  Velg dato
                </div>
                <div className={styles.datePickerIcon}>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M9 16.8809C8.3 16.8809 7.70833 16.6392 7.225 16.1559C6.74167 15.6725 6.5 15.0809 6.5 14.3809C6.5 13.6809 6.74167 13.0892 7.225 12.6059C7.70833 12.1225 8.3 11.8809 9 11.8809C9.7 11.8809 10.2917 12.1225 10.775 12.6059C11.2583 13.0892 11.5 13.6809 11.5 14.3809C11.5 15.0809 11.2583 15.6725 10.775 16.1559C10.2917 16.6392 9.7 16.8809 9 16.8809ZM5 22.3809C4.45 22.3809 3.97917 22.185 3.5875 21.7934C3.19583 21.4017 3 20.9309 3 20.3809V6.38086C3 5.83086 3.19583 5.36003 3.5875 4.96836C3.97917 4.57669 4.45 4.38086 5 4.38086H6V2.38086H8V4.38086H16V2.38086H18V4.38086H19C19.55 4.38086 20.0208 4.57669 20.4125 4.96836C20.8042 5.36003 21 5.83086 21 6.38086V20.3809C21 20.9309 20.8042 21.4017 20.4125 21.7934C20.0208 22.185 19.55 22.3809 19 22.3809H5ZM5 20.3809H19V10.3809H5V20.3809Z"
                      fill="#424940"
                    />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className={styles.datePickerReturn}>
              <div className={styles.dateInput}>
                <div className={styles.dateInputWrapper}>
                  <div className={styles.dateInputStateLayer}>
                    <div className={styles.dateInputContent}>
                      <div className={styles.dateInputContainer}>
                        <div className={styles.dateInputText}>
                          dd/mm/yyyy
                        </div>
                      </div>
                      <div className={styles.dateInputLabelContainer}>
                        <div className={styles.dateInputLabel}>
                          Dato
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className={styles.endDateInput}>
                <div className={styles.endDateInputWrapper}>
                  <div className={styles.endDateInputStateLayer}>
                    <div className={styles.endDateInputContent}>
                      <div className={styles.endDateInputLabelContainer}>
                        <div className={styles.endDateInputLabel}>
                          Sluttdato
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className={styles.datePickerActions}>
              <div className={styles.datePickerButtonContainer}>
                <button 
                  className={styles.datePickerSecondaryButton}
                  onClick={handleDatePickerCancel}
                >
                  <div className={styles.datePickerButtonContent}>
                    <div className={styles.datePickerButtonStateLayer}>
                      <div className={styles.datePickerButtonLabel}>
                        Avbryt
                      </div>
                    </div>
                  </div>
                </button>
                
                <button 
                  className={styles.datePickerPrimaryButton}
                  onClick={handleDatePickerOK}
                >
                  <div className={styles.datePickerButtonContent}>
                    <div className={styles.datePickerButtonStateLayer}>
                      <div className={styles.datePickerButtonLabel}>
                        OK
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className={styles.timeSection}>
        <div className={styles.timeSectionContainer}>
          <div className={styles.timeInput}>
            <div className={styles.timeInputWrapper}>
              <div className={styles.timeInputStateLayer}>
                <div className={styles.timeInputContent}>
                  <div className={styles.timeInputContainer}>
                    <input
                      className={styles.timeInputText}
                      type="text"
                      value={startTime}
                      onChange={(e) => handleTimeChange('startTime', e.target.value)}
                      placeholder="--:--"
                    />
                  </div>
                  <div className={styles.timeInputLabelContainer}>
                    <div className={styles.timeInputLabel}>
                      Starttid
                    </div>
                  </div>
                </div>
                <div className={styles.timeInputTrailingIcon}>
                  <button
                    className={styles.clearButton}
                    onClick={() => clearTime('startTime')}
                    aria-label="Clear start time"
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M8.4 17.3809L12 13.7809L15.6 17.3809L17 15.9809L13.4 12.3809L17 8.78086L15.6 7.38086L12 10.9809L8.4 7.38086L7 8.78086L10.6 12.3809L7 15.9809L8.4 17.3809ZM12 22.3809C10.6167 22.3809 9.31667 22.1184 8.1 21.5934C6.88333 21.0684 5.825 20.3559 4.925 19.4559C4.025 18.5559 3.3125 17.4975 2.7875 16.2809C2.2625 15.0642 2 13.7642 2 12.3809C2 10.9975 2.2625 9.69753 2.7875 8.48086C3.3125 7.26419 4.025 6.20586 4.925 5.30586C5.825 4.40586 6.88333 3.69336 8.1 3.16836C9.31667 2.64336 10.6167 2.38086 12 2.38086C13.3833 2.38086 14.6833 2.64336 15.9 3.16836C17.1167 3.69336 18.175 4.40586 19.075 5.30586C19.975 6.20586 20.6875 7.26419 21.2125 8.48086C21.7375 9.69753 22 10.9975 22 12.3809C22 13.7642 21.7375 15.0642 21.2125 16.2809C20.6875 17.4975 19.975 18.5559 19.075 19.4559C18.175 20.3559 17.1167 21.0684 15.9 21.5934C14.6833 22.1184 13.3833 22.3809 12 22.3809ZM12 20.3809C14.2333 20.3809 16.125 19.6059 17.675 18.0559C19.225 16.5059 20 14.6142 20 12.3809C20 10.1475 19.225 8.25586 17.675 6.70586C16.125 5.15586 14.2333 4.38086 12 4.38086C9.76667 4.38086 7.875 5.15586 6.325 6.70586C4.775 8.25586 4 10.1475 4 12.3809C4 14.6142 4.775 16.5059 6.325 18.0559C7.875 19.6059 9.76667 20.3809 12 20.3809Z"
                        fill="#424940"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className={styles.timeInput}>
            <div className={styles.timeInputWrapper}>
              <div className={styles.timeInputStateLayer}>
                <div className={styles.timeInputContent}>
                  <div className={styles.timeInputContainer}>
                    <input
                      className={styles.timeInputText}
                      type="text"
                      value={endTime}
                      onChange={(e) => handleTimeChange('endTime', e.target.value)}
                      placeholder="--:--"
                    />
                  </div>
                  <div className={styles.timeInputLabelContainer}>
                    <div className={styles.timeInputLabel}>
                      Sluttid
                    </div>
                  </div>
                </div>
                <div className={styles.timeInputTrailingIcon}>
                  <button
                    className={styles.clearButton}
                    onClick={() => clearTime('endTime')}
                    aria-label="Clear end time"
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M8.4 17.3809L12 13.7809L15.6 17.3809L17 15.9809L13.4 12.3809L17 8.78086L15.6 7.38086L12 10.9809L8.4 7.38086L7 8.78086L10.6 12.3809L7 15.9809L8.4 17.3809ZM12 22.3809C10.6167 22.3809 9.31667 22.1184 8.1 21.5934C6.88333 21.0684 5.825 20.3559 4.925 19.4559C4.025 18.5559 3.3125 17.4975 2.7875 16.2809C2.2625 15.0642 2 13.7642 2 12.3809C2 10.9975 2.2625 9.69753 2.7875 8.48086C3.3125 7.26419 4.025 6.20586 4.925 5.30586C5.825 4.40586 6.88333 3.69336 8.1 3.16836C9.31667 2.64336 10.6167 2.38086 12 2.38086C13.3833 2.38086 14.6833 2.64336 15.9 3.16836C17.1167 3.69336 18.175 4.40586 19.075 5.30586C19.975 6.20586 20.6875 7.26419 21.2125 8.48086C21.7375 9.69753 22 10.9975 22 12.3809C22 13.7642 21.7375 15.0642 21.2125 16.2809C20.6875 17.4975 19.975 18.5559 19.075 19.4559C18.175 20.3559 17.1167 21.0684 15.9 21.5934C14.6833 22.1184 13.3833 22.3809 12 22.3809ZM12 20.3809C14.2333 20.3809 16.125 19.6059 17.675 18.0559C19.225 16.5059 20 14.6142 20 12.3809C20 10.1475 19.225 8.25586 17.675 6.70586C16.125 5.15586 14.2333 4.38086 12 4.38086C9.76667 4.38086 7.875 5.15586 6.325 6.70586C4.775 8.25586 4 10.1475 4 12.3809C4 14.6142 4.775 16.5059 6.325 18.0559C7.875 19.6059 9.76667 20.3809 12 20.3809Z"
                        fill="#424940"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
