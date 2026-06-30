import { useOutletContext } from 'react-router-dom';
import type { SettingsContextType } from '../../../pages/SettingsPage';
import { useState, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Image as ImageIcon,
  Briefcase,
  FileText,
  Award,
  Calendar,
} from 'lucide-react';
import {
  useAddPortfolioItem,
  useDeletePortfolioItem,
  useAddExperience,
  useDeleteExperience,
  useAddPreviousProject,
  useDeletePreviousProject,
  useAddCertification,
  useDeleteCertification,
} from '../../../features/profile/hooks';

export const SeekerSettingsView = () => {
  const { form, handleChange, handleUpdate, updateUser, user } =
    useOutletContext<SettingsContextType>();
  const [newSkill, setNewSkill] = useState('');

  // Mutations
  const addPortfolioMutation = useAddPortfolioItem();
  const deletePortfolioMutation = useDeletePortfolioItem();
  const addExperienceMutation = useAddExperience();
  const deleteExperienceMutation = useDeleteExperience();
  const addProjectMutation = useAddPreviousProject();
  const deleteProjectMutation = useDeletePreviousProject();
  const addCertMutation = useAddCertification();
  const deleteCertMutation = useDeleteCertification();

  // --- Portfolio states ---
  const [isAddingPortfolio, setIsAddingPortfolio] = useState(false);
  const [portfolioForm, setPortfolioForm] = useState({
    title: '',
    description: '',
    link: '',
  });
  const [portfolioImage, setPortfolioImage] = useState<File | null>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);

  // --- Experience states ---
  const [isAddingExperience, setIsAddingExperience] = useState(false);
  const [experienceForm, setExperienceForm] = useState({
    title: '',
    company: '',
    startDate: '',
    endDate: '',
    description: '',
  });

  // --- Previous Projects states ---
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
    category: '',
    date: '',
    link: '',
  });
  const [projectImage, setProjectImage] = useState<File | null>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  // --- Certification states ---
  const [isAddingCert, setIsAddingCert] = useState(false);
  const [certForm, setCertForm] = useState({
    title: '',
    issuedBy: '',
    date: '',
    description: '',
  });
  const [certFile, setCertFile] = useState<File | null>(null);
  const certInputRef = useRef<HTMLInputElement>(null);

  const isUnchanged =
    form.availabilityText === (user as any)?.availabilityText &&
    JSON.stringify(form.skills) === JSON.stringify((user as any)?.skills);

  const isDisabled = isUnchanged || updateUser?.isPending;

  const addSkill = () => {
    if (newSkill.trim() && !form.skills.includes(newSkill.trim())) {
      handleChange('skills', [...form.skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    handleChange(
      'skills',
      form.skills.filter((s) => s !== skillToRemove)
    );
  };

  // --- Handlers ---
  const handleAddPortfolio = () => {
    const formData = new FormData();
    formData.append('title', portfolioForm.title);
    formData.append('description', portfolioForm.description);
    formData.append('link', portfolioForm.link);
    if (portfolioImage) formData.append('image', portfolioImage);

    addPortfolioMutation.mutate(formData, {
      onSuccess: () => {
        setIsAddingPortfolio(false);
        setPortfolioForm({ title: '', description: '', link: '' });
        setPortfolioImage(null);
      },
    });
  };

  const handleAddExperience = () => {
    addExperienceMutation.mutate(experienceForm, {
      onSuccess: () => {
        setIsAddingExperience(false);
        setExperienceForm({
          title: '',
          company: '',
          startDate: '',
          endDate: '',
          description: '',
        });
      },
    });
  };

  const handleAddProject = () => {
    const formData = new FormData();
    Object.entries(projectForm).forEach(([key, value]) => {
      formData.append(key, value);
    });
    if (projectImage) formData.append('image', projectImage);

    addProjectMutation.mutate(formData, {
      onSuccess: () => {
        setIsAddingProject(false);
        setProjectForm({
          title: '',
          description: '',
          category: '',
          date: '',
          link: '',
        });
        setProjectImage(null);
      },
    });
  };

  const handleAddCert = () => {
    const formData = new FormData();
    Object.entries(certForm).forEach(([key, value]) => {
      formData.append(key, value);
    });
    if (certFile) formData.append('file', certFile);

    addCertMutation.mutate(formData, {
      onSuccess: () => {
        setIsAddingCert(false);
        setCertForm({ title: '', issuedBy: '', date: '', description: '' });
        setCertFile(null);
      },
    });
  };

  return (
    <section className="flex flex-col gap-10 max-w-3xl pb-20">
      {/* Availability Section */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Calendar size={20} className="text-custom-green" />
          Tilgjengelighet
        </h3>
        <div className="relative group">
          <label
            htmlFor="availability"
            className="absolute left-4 top-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-tight"
          >
            Når er du tilgjengelig?
          </label>
          <textarea
            id="availability"
            rows={3}
            placeholder="F.eks. Mandag - Fredag: 08:00 - 16:00"
            className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-gray-100 outline-none rounded-2xl px-4 pt-6 pb-3 text-gray-900 font-medium transition-colors resize-none"
            value={form.availabilityText}
            onChange={(event) => handleChange('availabilityText', event.target.value)}
          />
        </div>
      </div>

      {/* Skills Section */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xl font-bold text-gray-900">Ferdigheter</h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Legg til en ferdighet..."
            className="flex-1 bg-gray-100 outline-none rounded-xl px-4 py-3 text-gray-900 font-medium"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSkill()}
          />
          <button
            onClick={addSkill}
            className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors"
          >
            Legg til
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {form.skills.map((skill) => (
            <div
              key={skill}
              className="flex items-center gap-2 bg-[#2F7E4715] px-4 py-2 rounded-full border border-[#2F7E4720]"
            >
              <span className="text-sm font-bold text-custom-green">{skill}</span>
              <button
                title="Fjern"
                type="button"
                onClick={() => removeSkill(skill)}
                className="text-custom-green hover:text-[#1a4a2a] opacity-60 hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleUpdate}
        disabled={isDisabled}
        className={`w-full font-bold text-lg py-4 rounded-2xl text-white shadow-sm transition-all duration-200
          ${
            isDisabled
              ? 'bg-custom-green cursor-not-allowed opacity-80'
              : 'bg-custom-green hover:shadow-md active:scale-[0.98]'
          }`}
      >
        {updateUser?.isPending ? 'Lagrer...' : 'Lagre endringer'}
      </button>

      {/* Experience Section */}
      <div className="flex flex-col gap-6 pt-10 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase size={20} className="text-custom-green" />
            Erfaring
          </h3>
          <button
            onClick={() => setIsAddingExperience(!isAddingExperience)}
            className="flex items-center gap-2 text-sm font-bold text-custom-green hover:opacity-80"
          >
            <Plus size={18} />
            Legg til erfaring
          </button>
        </div>

        {isAddingExperience && (
          <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Jobbtittel"
                className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium"
                value={experienceForm.title}
                onChange={(e) =>
                  setExperienceForm({
                    ...experienceForm,
                    title: e.target.value,
                  })
                }
              />
              <input
                type="text"
                placeholder="Bedrift / Klient"
                className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium"
                value={experienceForm.company}
                onChange={(e) =>
                  setExperienceForm({
                    ...experienceForm,
                    company: e.target.value,
                  })
                }
              />
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase ml-2">
                  Startdato
                </label>
                <input
                  type="date"
                  className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium"
                  value={experienceForm.startDate}
                  onChange={(e) =>
                    setExperienceForm({
                      ...experienceForm,
                      startDate: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase ml-2">
                  Sluttdato (valgfritt)
                </label>
                <input
                  type="date"
                  className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium"
                  value={experienceForm.endDate}
                  onChange={(e) =>
                    setExperienceForm({
                      ...experienceForm,
                      endDate: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <textarea
              placeholder="Beskrivelse av arbeidsoppgaver"
              rows={3}
              className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium resize-none"
              value={experienceForm.description}
              onChange={(e) =>
                setExperienceForm({
                  ...experienceForm,
                  description: e.target.value,
                })
              }
            />
            <div className="flex gap-3">
              <button
                onClick={handleAddExperience}
                disabled={addExperienceMutation.isPending || !experienceForm.title}
                className="flex-1 bg-black text-white font-bold py-3 rounded-xl disabled:opacity-50"
              >
                {addExperienceMutation.isPending ? 'Lagrer...' : 'Lagre erfaring'}
              </button>
              <button
                onClick={() => setIsAddingExperience(false)}
                className="px-6 py-3 font-bold text-gray-500 hover:text-gray-700"
              >
                Avbryt
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {(user as any)?.experience?.map((exp: any) => (
            <div
              key={exp._id}
              className="bg-white border border-gray-100 rounded-2xl p-5 flex justify-between items-start group"
            >
              <div>
                <h4 className="font-bold text-gray-900">{exp.title}</h4>
                <p className="text-sm font-bold text-custom-green">{exp.company}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(exp.startDate).toLocaleDateString('no-NO')} -{' '}
                  {exp.endDate ? new Date(exp.endDate).toLocaleDateString('no-NO') : 'Nåværende'}
                </p>
                {exp.description && <p className="text-sm text-gray-600 mt-2">{exp.description}</p>}
              </div>
              <button
                title="Slett"
                onClick={() => deleteExperienceMutation.mutate(exp._id)}
                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Previous Projects Section */}
      <div className="flex flex-col gap-6 pt-10 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={20} className="text-custom-green" />
            Tidligere prosjekter
          </h3>
          <button
            onClick={() => setIsAddingProject(!isAddingProject)}
            className="flex items-center gap-2 text-sm font-bold text-custom-green hover:opacity-80"
          >
            <Plus size={18} />
            Legg til prosjekt
          </button>
        </div>

        {isAddingProject && (
          <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Prosjekt tittel"
                className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium"
                value={projectForm.title}
                onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
              />
              <input
                type="text"
                placeholder="Kategori (f.eks. Maling, Snekker)"
                className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium"
                value={projectForm.category}
                onChange={(e) => setProjectForm({ ...projectForm, category: e.target.value })}
              />
              <input
                type="date"
                className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium"
                value={projectForm.date}
                onChange={(e) => setProjectForm({ ...projectForm, date: e.target.value })}
              />
              <input
                type="text"
                placeholder="Link (valgfritt)"
                className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium"
                value={projectForm.link}
                onChange={(e) => setProjectForm({ ...projectForm, link: e.target.value })}
              />
            </div>
            <textarea
              placeholder="Beskrivelse av prosjektet"
              rows={2}
              className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium resize-none"
              value={projectForm.description}
              onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
            />

            <div
              onClick={() => projectInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white transition-colors"
            >
              <input
                title="Laste opp bilde"
                type="file"
                ref={projectInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && !file.type.startsWith('image/')) {
                    import('react-hot-toast').then(({ toast }) =>
                      toast.error('Vennligst velg et bilde format')
                    );
                    return;
                  }
                  setProjectImage(file || null);
                }}
              />
              {projectImage ? (
                <div className="flex items-center gap-2 text-custom-green font-bold">
                  <ImageIcon size={20} />
                  <span>{projectImage.name}</span>
                </div>
              ) : (
                <>
                  <ImageIcon size={24} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-500">
                    Klikk for å laste opp prosjektbilde
                  </span>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddProject}
                disabled={addProjectMutation.isPending || !projectForm.title}
                className="flex-1 bg-black text-white font-bold py-3 rounded-xl disabled:opacity-50"
              >
                {addProjectMutation.isPending ? 'Lagrer...' : 'Lagre prosjekt'}
              </button>
              <button
                onClick={() => setIsAddingProject(false)}
                className="px-6 py-3 font-bold text-gray-500 hover:text-gray-700"
              >
                Avbryt
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(user as any)?.previousProjects?.map((project: any) => (
            <div
              key={project._id}
              className="bg-white border border-gray-100 rounded-2xl p-4 flex gap-4 items-center"
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                <img
                  src={project.imageUrl || '/placeholder-project.png'}
                  className="w-full h-full object-cover"
                  alt=""
                />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 truncate">{project.title}</h4>
                <p className="text-xs text-custom-green font-bold">{project.category}</p>
                <p className="text-[10px] text-gray-400">
                  {project.date && new Date(project.date).getFullYear()}
                </p>
              </div>
              <button
                title="Slett"
                onClick={() => deleteProjectMutation.mutate(project._id)}
                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Portfolio Section */}
      <div className="flex flex-col gap-6 pt-10 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ImageIcon size={20} className="text-custom-green" />
            Portfolio
          </h3>
          <button
            onClick={() => setIsAddingPortfolio(!isAddingPortfolio)}
            className="flex items-center gap-2 text-sm font-bold text-custom-green hover:opacity-80 transition-opacity"
          >
            <Plus size={18} />
            Legg til media
          </button>
        </div>

        {isAddingPortfolio && (
          <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <input
              type="text"
              placeholder="Tittel"
              className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium"
              value={portfolioForm.title}
              onChange={(e) => setPortfolioForm({ ...portfolioForm, title: e.target.value })}
            />
            <textarea
              placeholder="Beskrivelse"
              rows={2}
              className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium resize-none"
              value={portfolioForm.description}
              onChange={(e) =>
                setPortfolioForm({
                  ...portfolioForm,
                  description: e.target.value,
                })
              }
            />
            <div
              onClick={() => portfolioInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white transition-colors"
            >
              <input
                title="Laste opp bilde"
                type="file"
                ref={portfolioInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && !file.type.startsWith('image/')) {
                    import('react-hot-toast').then(({ toast }) =>
                      toast.error('Vennligst velg et bilde format')
                    );
                    return;
                  }
                  setPortfolioImage(file || null);
                }}
              />
              {portfolioImage ? (
                <div className="flex items-center gap-2 text-custom-green font-bold">
                  <ImageIcon size={20} />
                  <span>{portfolioImage.name}</span>
                </div>
              ) : (
                <>
                  <ImageIcon size={24} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-500">
                    Klikk for å laste opp bilde
                  </span>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleAddPortfolio}
                disabled={addPortfolioMutation.isPending || !portfolioForm.title}
                className="flex-1 bg-black text-white font-bold py-3 rounded-xl disabled:opacity-50"
              >
                {addPortfolioMutation.isPending ? 'Lagrer...' : 'Lagre media'}
              </button>
              <button
                onClick={() => setIsAddingPortfolio(false)}
                className="px-6 py-3 font-bold text-gray-500 hover:text-gray-700"
              >
                Avbryt
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {(user as any)?.portfolio?.map((item: any) => (
            <div
              key={item._id}
              className="group relative aspect-square bg-gray-100 rounded-2xl overflow-hidden border border-gray-100"
            >
              <img src={item.imageUrl} className="w-full h-full object-cover" alt="" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                <h5 className="text-white text-xs font-bold truncate w-full">{item.title}</h5>
                <button
                  onClick={() => deletePortfolioMutation.mutate(item._id)}
                  className="mt-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Certifications Section */}
      <div className="flex flex-col gap-6 pt-10 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Award size={20} className="text-custom-green" />
            Sertifiseringer / Fagbrev
          </h3>
          <button
            onClick={() => setIsAddingCert(!isAddingCert)}
            className="flex items-center gap-2 text-sm font-bold text-custom-green hover:opacity-80"
          >
            <Plus size={18} />
            Legg til bevis
          </button>
        </div>

        {isAddingCert && (
          <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Tittel på sertifikat"
                className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium"
                value={certForm.title}
                onChange={(e) => setCertForm({ ...certForm, title: e.target.value })}
              />
              <input
                type="text"
                placeholder="Utstedt av"
                className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium"
                value={certForm.issuedBy}
                onChange={(e) => setCertForm({ ...certForm, issuedBy: e.target.value })}
              />
              <input
                type="date"
                className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium"
                value={certForm.date}
                onChange={(e) => setCertForm({ ...certForm, date: e.target.value })}
              />
            </div>
            <textarea
              placeholder="Kort beskrivelse (valgfritt)"
              rows={2}
              className="bg-white rounded-xl px-4 py-3 outline-none border border-gray-200 font-medium resize-none"
              value={certForm.description}
              onChange={(e) => setCertForm({ ...certForm, description: e.target.value })}
            />

            <div
              onClick={() => certInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white transition-colors"
            >
              <input
                title="Laste opp fil"
                type="file"
                ref={certInputRef}
                className="hidden"
                accept=".pdf,image/*"
                onChange={(e) => setCertFile(e.target.files?.[0] || null)}
              />
              {certFile ? (
                <div className="flex items-center gap-2 text-custom-green font-bold">
                  <FileText size={20} />
                  <span>{certFile.name}</span>
                </div>
              ) : (
                <>
                  <Award size={24} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-500">
                    Last opp sertifikat (PDF eller bilde)
                  </span>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddCert}
                disabled={addCertMutation.isPending || !certForm.title}
                className="flex-1 bg-black text-white font-bold py-3 rounded-xl disabled:opacity-50"
              >
                {addCertMutation.isPending ? 'Lagrer...' : 'Lagre sertifikat'}
              </button>
              <button
                onClick={() => setIsAddingCert(false)}
                className="px-6 py-3 font-bold text-gray-500 hover:text-gray-700"
              >
                Avbryt
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {(user as any)?.certifications?.map((cert: any) => (
            <div
              key={cert._id}
              className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4 group"
            >
              <div className="w-12 h-12 bg-custom-green/10 rounded-xl flex items-center justify-center text-custom-green">
                <Award size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 truncate">{cert.title}</h4>
                <p className="text-xs text-gray-500">{cert.issuedBy}</p>
              </div>
              <button
                title="Slett"
                onClick={() => deleteCertMutation.mutate(cert._id)}
                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
