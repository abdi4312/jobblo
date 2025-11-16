import { useState } from 'react';
import styles from './EditJobPage.module.css';
import { BackNavigation } from '../components/shared/BackNavigation/BackNavigation';
import { ImageUploadSection } from '../components/shared/ImageUploadSection/ImageUploadSection';
import { TextInput } from '../components/shared/TextInput/TextInput';
import { RadioGroup } from '../components/shared/RadioGroup/RadioGroup';
import { ChipGroup } from '../components/shared/ChipGroup/ChipGroup';
import { DateTimePicker } from '../components/shared/DateTimePicker/DateTimePicker';
import { ActionButtons } from '../components/shared/ActionButtons/ActionButtons';

interface JobData {
  title: string;
  category: string;
  subcategory: string;
  address: string;
  description: string;
  equipment: 'all' | 'some' | 'none';
  userEquipment: string[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

export default function EditJobPage() {
  const [jobData, setJobData] = useState<JobData>({
    title: 'Sage ned et tre',
    category: 'Hage',
    subcategory: 'Hugge tre',
    address: 'Oslo gate 16, 0512 Oslo',
    description: 'Jeg trenger en som kan sage ned et tre som har vært i veien for oss. Treet er ca 7 meter høy og er ca 1 i diameter.',
    equipment: 'some',
    userEquipment: ['Sag', 'Vernehansker', 'Hørselvern', 'Øks'],
    startDate: '',
    endDate: '',
    startTime: '11:30',
    endTime: ''
  });

  const [images, setImages] = useState([
    { id: '1', url: 'https://api.builder.io/api/v1/image/assets/TEMP/8c60d24c0d79fe73b0a0ca1fb5bbf190855847bd?width=256', description: '' },
    { id: '2', url: 'https://api.builder.io/api/v1/image/assets/TEMP/65dce074b1661e7410c0035093326eb4eb74872d?width=256', description: '' },
    { id: '3', url: 'https://api.builder.io/api/v1/image/assets/TEMP/f21c3775e77dcb8249427008eafb2fee63af9617?width=256', description: '' }
  ]);

  const equipmentOptions = [
    { value: 'all', label: 'Alt utstyret' },
    { value: 'some', label: 'Noe utstyr' },
    { value: 'none', label: 'Ikke noe utstyr' }
  ];

  const handleInputChange = (field: keyof JobData, value: string | string[]) => {
    setJobData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageRemove = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  const handleImageDescriptionChange = (imageId: string, description: string) => {
    setImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, description } : img
    ));
  };

  const handleAddImages = () => {
    // Handle adding new images
    console.log('Add images clicked');
  };

  const handleChipRemove = (chip: string) => {
    setJobData(prev => ({
      ...prev,
      userEquipment: prev.userEquipment.filter(item => item !== chip)
    }));
  };

  const handlePreview = () => {
    console.log('Preview job:', jobData);
  };

  const handlePublish = () => {
    console.log('Publish job:', jobData);
  };

  const handleDelete = () => {
    console.log('Delete job');
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <BackNavigation text="Oppdrag" />
        <div className={styles.headerDivider}></div>
      </div>

      <div className={styles.content}>
        <ImageUploadSection
          images={images}
          onImageRemove={handleImageRemove}
          onImageDescriptionChange={handleImageDescriptionChange}
          onAddImages={handleAddImages}
        />

        <div className={styles.formSection}>
          <TextInput
            label="Oppdragstittel"
            value={jobData.title}
            onChange={(value) => handleInputChange('title', value)}
          />

          <TextInput
            label="Hovedkategori"
            value={jobData.category}
            onChange={(value) => handleInputChange('category', value)}
          />

          <TextInput
            label="Underkategori"
            value={jobData.subcategory}
            onChange={(value) => handleInputChange('subcategory', value)}
          />

          <TextInput
            label="Adresse"
            value={jobData.address}
            onChange={(value) => handleInputChange('address', value)}
          />

          <TextInput
            label="Beskrivelse"
            value={jobData.description}
            onChange={(value) => handleInputChange('description', value)}
            multiline
          />

          <div className={styles.equipmentSection}>
            <div className={styles.equipmentHeader}>
              <span className={styles.equipmentLabel}>Jeg har...</span>
            </div>
            <RadioGroup
              options={equipmentOptions}
              selectedValue={jobData.equipment}
              onChange={(value) => handleInputChange('equipment', value)}
            />
            <div className={styles.equipmentFooter}>
              <span className={styles.equipmentLabel}>...som trengs for oppdraget</span>
            </div>
          </div>

          <div className={styles.userEquipmentSection}>
            <div className={styles.equipmentHeader}>
              <span className={styles.equipmentLabel}>Hvilket utstyr har du?</span>
            </div>
            <ChipGroup
              chips={jobData.userEquipment}
              onChipRemove={handleChipRemove}
            />
          </div>

          <DateTimePicker
            startDate={jobData.startDate}
            endDate={jobData.endDate}
            startTime={jobData.startTime}
            endTime={jobData.endTime}
            onDateChange={(field, value) => handleInputChange(field as keyof JobData, value)}
          />

          <ActionButtons
            onPreview={handlePreview}
            onPublish={handlePublish}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  );
}
