import CreateJobForm from "../../components/CreateJobForm/CreateJobForm";
import mainLink from "../../api/mainURLs";
import { useUserStore } from "../../stores/userStore";
import { useNavigate } from "react-router-dom";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";
import { toast } from 'react-toastify';
import { BriefcaseBusiness } from "lucide-react";

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
      const response = await mainLink.post("/api/services", jobData);

      if (response.data) {
        console.log('Job created successfully');
        const result = response.data;
        console.log(result);
        toast.success('Oppdrag publisert!');
        navigate(-1);
      } else {
        // const errorText = await response.json();
        console.error('Failed to create job. Status:', response.status, 'Error:');
        toast.error(`Kunne ikke publisere oppdrag. Status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error creating job:', error);
      toast.error('Det oppstod en feil ved kommunikasjon med serveren');
    }
  };

  return (
    <>
      <div className="max-w-300 mx-auto">
        {/* <ProfileTitleWrapper title="Oppdrag" buttonText="Tilbake" /> */}
        <div className="flex flex-col gap-4 px-4 md:px-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {/* Icon Container */}
            <span className="p-4.5 shadow-md text-[#2F7E47] bg-[#FFFFFF1A] rounded-[14px] inline-flex items-center justify-center">
              <BriefcaseBusiness size={20} />
            </span>

            {/* Heading - Responsive text size */}
            <h2 className="text-[28px] md:text-[42px] font-bold leading-tight">
              Legg ut oppdrag
            </h2>
          </div>

          {/* Description - Responsive text size */}
          <p className="text-[#4A5565] text-[16px] md:text-[18px] font-normal leading-relaxed">
            Fyll ut informasjonen under for å legge ut ditt oppdrag
          </p>
        </div>

        <div >
          <CreateJobForm onSubmit={handleFormSubmit} userId={userId} />
        </div>
      </div>

    </>
  );
}
