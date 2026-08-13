import CreateJobForm from '../../components/CreateJobForm/CreateJobForm';
import mainLink from '../../api/mainURLs';
import { useUserStore } from '../../stores/userStore';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BriefcaseBusiness } from 'lucide-react';
import { useJobDetailQuery } from '../../features/jobDetail/hook.ts';
import { Spinner } from '../../components/Ui/Spinner';

export default function LeggUtOppdrag() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);

  const { data: job, isLoading } = useJobDetailQuery(id || '');

  if (!user) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Du må være logget inn for å legge ut oppdrag</h2>
        <p>Vennligst logg inn for å fortsette.</p>
      </div>
    );
  }

  if (isEditMode && isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner />
      </div>
    );
  }

  const userId = user._id;

  const handleFormSubmit = async (formData: FormData) => {
    console.log('Sending job data (FormData)');

    try {
      const response = isEditMode
        ? await mainLink.put(`/api/services/${id}`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          })
        : await mainLink.post('/api/services', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

      if (!response.data) {
        // Treat "no body" as a failure like any other, so the caller keeps the
        // draft instead of clearing it on a response we can't confirm.
        throw new Error(`Uventet svar fra serveren (status ${response.status})`);
      }

      toast.success(isEditMode ? 'Oppdrag oppdatert!' : 'Oppdrag publisert!');
      navigate('/');
    } catch (error) {
      // Re-thrown on purpose: useCreateJobForm only preserves the IndexedDB
      // draft if this promise rejects. Swallowing the error here made every
      // failed publish look like a success to the caller, which then wiped
      // everything the user had typed. It also owns the error toast, so we
      // deliberately don't show one too.
      console.error('Error saving job:', error);
      throw error;
    }
  };

  const coordinates = job?.location?.coordinates; // GeoJSON order: [lng, lat]

  const initialData = job
    ? {
        title: job.title,
        description: job.description,
        price: job.price,
        address: job.location?.address,
        city: job.location?.city,
        countyCode: job.countyCode,
        municipalityCode: job.municipalityCode,
        areaCode: job.areaCode,
        latitude: coordinates?.[1],
        longitude: coordinates?.[0],
        categories: job.categories,
        urgent: job.urgent,
        equipment: job.equipment,
        fromDate: job.fromDate,
        toDate: job.toDate,
        durationValue: job.duration?.value,
        durationUnit: job.duration?.unit,
        paymentType: job.paymentType,
        hourlyRate: job.hourlyRate,
        maxApplicants: job.maxApplicants,
        images: job.images,
      }
    : undefined;

  return (
    <>
      <div className="max-w-300 mx-auto">
        <div className="flex flex-col gap-4 px-4 md:px-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <span className="p-4.5 shadow-md text-custom-green bg-[#FFFFFF1A] rounded-[14px] inline-flex items-center justify-center">
              <BriefcaseBusiness size={20} />
            </span>

            <h2 className="text-[28px] md:text-[42px] font-bold leading-tight">
              {isEditMode ? 'Rediger oppdrag' : 'Legg ut oppdrag'}
            </h2>
          </div>

          <p className="text-[#4A5565] text-[16px] md:text-[18px] font-normal leading-relaxed">
            {isEditMode
              ? 'Oppdater informasjonen under for å endre ditt oppdrag'
              : 'Fyll ut informasjonen under for å legge ut ditt oppdrag'}
          </p>
        </div>

        <div>
          <CreateJobForm
            onSubmit={handleFormSubmit}
            userId={userId}
            initialData={initialData}
            isEditMode={isEditMode}
          />
        </div>
      </div>
    </>
  );
}
