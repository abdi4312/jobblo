import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import mainLink from '../../api/mainURLs';
import CreateJobForm from '../../components/CreateJobForm/CreateJobForm';
import { Spinner } from '../../components/Ui/Spinner';
import { BackLink } from '../../components/Ui/BackLink';
import { MICRO_LABEL } from '../../theme/brand';
import { useUserStore } from '../../stores/userStore';

function useAdminJobDetail(id: string) {
  return useQuery({
    queryKey: ['admin', 'service', id],
    queryFn: async () => {
      const res = await mainLink.get(`/api/admin/services/${id}`);
      return res.data.data.service;
    },
    enabled: !!id,
  });
}

export default function AdminEditJobPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);

  const { data: job, isLoading } = useAdminJobDetail(id ?? '');

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-10 text-center text-gray-500">Oppdrag ikke funnet.</div>
    );
  }

  const handleFormSubmit = async (formData: FormData) => {
    await mainLink.put(`/api/admin/services/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    navigate('/dashboard/services');
  };

  const coords = job.location?.coordinates; // GeoJSON [lng, lat]

  const initialData = {
    title: job.title,
    description: job.description,
    price: job.price,
    address: job.location?.address,
    city: job.location?.city,
    countyCode: job.countyCode,
    municipalityCode: job.municipalityCode,
    areaCode: job.areaCode,
    latitude: coords?.[1],
    longitude: coords?.[0],
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
  };

  return (
    <div className="min-h-screen bg-[#EFF0EA]">
      <div className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6">
        <BackLink fallback="/dashboard/services" />

        <header className="mt-6 mb-8">
          <p className={MICRO_LABEL}>Admin · Rediger</p>
          <h1 className="mt-2 text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-tight tracking-[-0.04em] text-[#0B0B0B]">
            Rediger oppdraget
          </h1>
          <p className="mt-2 max-w-lg text-[0.9375rem] leading-relaxed text-[#63665F]">
            Endringene lagres direkte. Eier av oppdraget vil se dem umiddelbart.
          </p>
        </header>
      </div>

      <CreateJobForm
        onSubmit={handleFormSubmit}
        userId={user?._id ?? ''}
        initialData={initialData}
        isEditMode
      />
    </div>
  );
}
