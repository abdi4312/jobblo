import styles from './ProfileSettings.module.css';
import { BackNavigation } from '../BackNavigation/BackNavigation';
import { ProfilePictureSection } from '../ProfilePictureSection/ProfilePictureSection';
import { ProfileField } from '../ProfileField/ProfileField';

export function ProfileSettings() {
  const handleFieldEdit = (fieldName: string) => {
    console.log(`Edit ${fieldName}`);
    // Handle field editing logic here
  };

  const handleChangeImage = () => {
    console.log('Change profile image');
    // Handle image change logic here
  };

  return (
    <div className={styles.container}>
      <div className={styles.navigation}>
        <BackNavigation />
      </div>
      
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Min profil</h1>
        </div>
        <div className={styles.divider}></div>
      </div>

      <div className={styles.content}>
        <ProfilePictureSection onChangeImage={handleChangeImage} />
        
        <div className={styles.fieldsSection}>
          <ProfileField 
            label="Epost" 
            value="olanormannen@theman.com" 
            onEdit={() => handleFieldEdit('email')}
          />
          <ProfileField 
            label="Passord" 
            value="************" 
            onEdit={() => handleFieldEdit('password')}
          />
          <ProfileField 
            label="Mobil" 
            value="645 23 452" 
            onEdit={() => handleFieldEdit('mobile')}
          />
        </div>

        <div className={styles.fieldsSection}>
          <ProfileField 
            label="Fornavn" 
            value="Ola" 
            onEdit={() => handleFieldEdit('firstName')}
          />
          <ProfileField 
            label="Etternavn" 
            value="Normann" 
            onEdit={() => handleFieldEdit('lastName')}
          />
          <ProfileField 
            label="Født" 
            value="1832" 
            onEdit={() => handleFieldEdit('birthYear')}
          />
          <ProfileField 
            label="Kjønn" 
            value="Mann" 
            onEdit={() => handleFieldEdit('gender')}
          />
        </div>

        <div className={styles.fieldsSection}>
          <ProfileField 
            label="Adresse" 
            value="Ola gate 23" 
            onEdit={() => handleFieldEdit('address')}
          />
          <ProfileField 
            label="Postnummer" 
            value="1337" 
            onEdit={() => handleFieldEdit('postalCode')}
          />
          <ProfileField 
            label="Poststed" 
            value="Sandvika" 
            onEdit={() => handleFieldEdit('city')}
          />
          <ProfileField 
            label="Land" 
            value="Norge" 
            onEdit={() => handleFieldEdit('country')}
          />
        </div>
      </div>
    </div>
  );
}
