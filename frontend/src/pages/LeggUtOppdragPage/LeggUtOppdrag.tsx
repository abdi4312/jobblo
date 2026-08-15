import CreateJobForm from '../../components/CreateJobForm/CreateJobForm';
import mainLink from '../../api/mainURLs';
import { useUserStore } from '../../stores/userStore';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useJobDetailQuery } from '../../features/jobDetail/hook.ts';
import { Spinner } from '../../components/Ui/Spinner';
import { BackLink } from '../../components/Ui/BackLink';
import { MICRO_LABEL } from '../../theme/brand';

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
    <div className="min-h-screen bg-[#EFF0EA]">
      <div className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6">
        <BackLink fallback="/home" />

        <header className="mt-6 mb-8">
          <p className={MICRO_LABEL}>{isEditMode ? 'Rediger' : 'Nytt oppdrag'}</p>
          <h1 className="mt-2 text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-tight tracking-[-0.04em] text-[#0B0B0B]">
            {isEditMode ? 'Rediger oppdraget' : 'Legg ut et oppdrag'}
          </h1>
          <p className="mt-2 max-w-lg text-[0.9375rem] leading-relaxed text-[#63665F]">
            {isEditMode
              ? 'Endringene blir synlige for alle som ser oppdraget.'
              : 'Fire korte steg. Du kan forhåndsvise underveis, og utkastet lagres automatisk.'}
          </p>
        </header>
      </div>

      <CreateJobForm
        onSubmit={handleFormSubmit}
        userId={userId}
        initialData={initialData}
        isEditMode={isEditMode}
      />
    </div>
  );
}
