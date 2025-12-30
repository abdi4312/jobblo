import CreateJobForm from "../../components/CreateJobForm/CreateJobForm";
import { mainLink } from "../../api/mainURLs";
import { useUserStore } from "../../stores/userStore";
import { useNavigate } from "react-router-dom";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";
import { toast } from 'react-toastify';

export default function LeggUtOppdrag() {
  const navigate = useNavigate();
  const userToken = useUserStore((state) => state.tokens);
  const user = useUserStore((state) => state.user);

  if (!user || !userToken?.accessToken) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Du må være logget inn for å legge ut oppdrag</h2>
        <p>Vennligst logg inn for å fortsette.</p>
      </div>
    );
  }

  const userId = user._id;

  const handleFormSubmit = async (jobData: any) => {
    console.log('Sending job data:', jobData); // Log the data being sent
    
    if (!userToken?.accessToken) {
      toast.error('Du må være logget inn for å publisere et oppdrag');
      return;
    }
    
    try {
      const response = await fetch(`${mainLink}/api/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken.accessToken}`,
        },
        body: JSON.stringify(jobData),
      });
      
      if (response.ok) {
        console.log('Job created successfully');
        const result = await response.json();
        console.log(result);
        toast.success('Oppdrag publisert!');
        navigate(-1);
      } else {
        const errorText = await response.text();
        console.error('Failed to create job. Status:', response.status, 'Error:', errorText);
        toast.error(`Kunne ikke publisere oppdrag. Status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error creating job:', error);
      toast.error('Det oppstod en feil ved kommunikasjon med serveren');
    }
  };

  return (
    <>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <ProfileTitleWrapper title="Oppdrag" buttonText="Tilbake" />
      </div>

      <div style={{height:"2px", width:"90vw", backgroundColor:"var(--color-muted-gray)", margin:"auto"}}></div>

      <div style={{ padding: "20px", maxWidth:"900px", margin:"auto", paddingBottom:"80px" }}>
        <CreateJobForm onSubmit={handleFormSubmit} userId={userId} />
      </div>
    </>
  );
}
