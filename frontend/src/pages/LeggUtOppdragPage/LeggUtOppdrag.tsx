import CreateJobForm from "../../components/CreateJobForm/CreateJobForm";
import { mainLink } from "../../api/mainURLs";
import { useUserStore } from "../../stores/userStore";

export default function LeggUtOppdrag() {
  const userToken = useUserStore((state) => state.tokens);
  const user = useUserStore((state) => state.user);
  const userId = user?.id || "68d98d54a60a9dfeeaec8dc6"; // Fallback to placeholder

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>
          arrow_left
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
