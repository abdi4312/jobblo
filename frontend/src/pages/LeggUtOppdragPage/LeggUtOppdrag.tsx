import CreateJobForm from "../../components/CreateJobForm/CreateJobForm";
import mainLink  from "../../api/mainURLs";
import { useUserStore } from "../../stores/userStore";
import { useNavigate } from "react-router-dom";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";
import { toast } from 'react-toastify';

export default function LeggUtOppdrag() {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);

  if (!user) {
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
    
    try {
      // If urgent is checked, store form data and redirect to payment FIRST
      if (jobData.urgent) {
        // Store job data in localStorage
        localStorage.setItem('pendingUrgentJob', JSON.stringify(jobData));
        
        // Redirect to payment (we'll create the service after payment)
        const paymentResponse = await mainLink.post("/api/stripe/create-urgent-payment-initial", {
          userId: user._id
        });
        
        if (paymentResponse.data?.url) {
          window.location.href = paymentResponse.data.url;
          return;
        } else {
          toast.error('Kunne ikke starte betalingsprosessen');
          return;
        }
      }
      
      // If not urgent, create service normally
      const response = await mainLink.post("/api/services", jobData);

      if (response.data) {
        console.log('Job created successfully');
        toast.success('Oppdrag publisert!');
        navigate(-1);
      } else {
        console.error('Failed to create job. Status:', response.status, 'Error:');
        toast.error(`Kunne ikke publisere oppdrag. Status: ${response.status}`);
      }
    } catch (error: any) {
      console.error('Error creating job:', error);
      console.error('Error response:', error.response?.data);
      toast.error(error.response?.data?.error || 'Det oppstod en feil ved kommunikasjon med serveren');
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
