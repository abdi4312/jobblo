import CreateJobForm from "../../components/CreateJobForm/CreateJobForm";
import { mainLink } from "../../api/mainURLs";
import { useUserStore } from "../../stores/userStore";
import { useNavigate } from "react-router-dom";

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
      alert('Du må være logget inn for å publisere et oppdrag');
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
        // Redirect or show success message
        alert('Oppdrag publisert!');
      } else {
        const errorText = await response.text();
        console.error('Failed to create job. Status:', response.status, 'Error:', errorText);
        alert(`Kunne ikke publisere oppdrag. Status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error creating job:', error);
      alert('Det oppstod en feil ved kommunikasjon med serveren');
    }
  };

  return (
    <>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        padding: '20px',
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        <span 
          className="material-symbols-outlined" 
          onClick={() => navigate(-1)}
          style={{ fontSize: '32px', cursor: 'pointer' }}
        >
          arrow_back
        </span>
        <h2 style={{ margin: 0 }}>Oppdrag</h2>
      </div>

      <div style={{height:"2px", width:"90vw", backgroundColor:"var(--color-muted-gray)", margin:"auto"}}></div>

      <div style={{ padding: "20px", maxWidth:"900px", margin:"auto", paddingBottom:"80px" }}>
        <CreateJobForm onSubmit={handleFormSubmit} userId={userId} />
      </div>
    </>
  );
}
