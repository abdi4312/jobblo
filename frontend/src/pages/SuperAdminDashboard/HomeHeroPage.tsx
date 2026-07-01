import React, { useState, useRef } from 'react';
import {
  useAllHeroes,
  useCreateHeroMutation,
  useUpdateHeroMutation,
  useDeleteHeroMutation,
} from '../../features/homeHero/hooks';
import { Plus, Trash2, Edit2, Check, X, Upload, Film, Image as ImageIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ConfirmDialog from '../../components/Ui/ConfirmDialog';

const HomeHeroPage: React.FC = () => {
  const { data: heroes, isLoading } = useAllHeroes();
  const createMutation = useCreateHeroMutation();
  const updateMutation = useUpdateHeroMutation();
  const deleteMutation = useDeleteHeroMutation();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [heroToDelete, setHeroToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    isActive: true,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const resetForm = () => {
    setFormData({ isActive: true });
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = new FormData();
    data.append('isActive', String(formData.isActive));
    if (selectedFile) {
      data.append('media', selectedFile);
    }

    if (editingId) {
      updateMutation.mutate(
        { id: editingId, formData: data },
        {
          onSuccess: () => {
            toast.success('Hero oppdatert!');
            resetForm();
          },
          onError: () => toast.error('Kunne ikke oppdatere hero'),
        }
      );
    } else {
      if (!selectedFile) {
        toast.error('Vennligst velg et bilde aur video');
        return;
      }
      createMutation.mutate(data, {
        onSuccess: () => {
          toast.success('Hero opprettet!');
          resetForm();
        },
        onError: () => toast.error('Kunne ikke opprette hero'),
      });
    }
  };

  const handleEdit = (hero: any) => {
    setFormData({
      isActive: hero.isActive,
    });
    setEditingId(hero._id);
    setPreviewUrl(hero.mediaUrl);
    setIsAdding(true);
  };

  const confirmDelete = () => {
    if (!heroToDelete) return;
    deleteMutation.mutate(heroToDelete, {
      onSuccess: () => {
        toast.success('Hero slettet');
        setHeroToDelete(null);
      },
      onError: () => {
        toast.error('Kunne ikke slette hero');
        setHeroToDelete(null);
      },
    });
  };

  if (isLoading) return <div className="p-8">Laster...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Manage Home Hero</h1>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-green-800 text-white px-6 py-2 rounded-xl font-bold hover:bg-green-900 transition-all"
          >
            <Plus size={20} /> Add New Hero
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 mb-8 animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">{editingId ? 'Edit Hero' : 'New Hero'}</h2>
            <button title="Close" onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-5 h-5 accent-green-800"
                />
                <label htmlFor="isActive" className="text-sm font-bold text-gray-700 uppercase">
                  Set as Active
                </label>
              </div>
              <p className="text-sm text-gray-500 italic">
                Note: Titles and subtitles are static in the frontend. Only the media (image/video)
                is managed here.
              </p>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-bold text-gray-700 uppercase mb-2">
                Media (Image/Video)
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-all overflow-hidden relative group"
              >
                {previewUrl ? (
                  <>
                    {previewUrl.includes('video') || selectedFile?.type.startsWith('video/') ? (
                      <video
                        src={previewUrl}
                        className="w-full h-full object-cover"
                        autoPlay
                        loop
                        muted
                      />
                    ) : (
                      <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="bg-white p-4 rounded-full shadow-lg">
                        <Upload size={24} className="text-green-800" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-8">
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4 inline-block">
                      <Upload size={24} className="text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500 font-medium">
                      Click to upload image or video
                    </p>
                    <p className="text-xs text-gray-400 mt-2">MP4, JPG, PNG, WEBP</p>
                  </div>
                )}
              </div>
              <input
                title="Upload Media"
                id="media"
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,video/*"
              />

              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full bg-green-800 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-900 transition-all disabled:opacity-50 mt-4 shadow-lg shadow-green-800/20"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : editingId
                    ? 'Update Hero'
                    : 'Save Hero'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {heroes?.map((hero: any) => (
          <div
            key={hero._id}
            className={`bg-white p-6 rounded-3xl border ${hero.isActive ? 'border-green-200 bg-green-50/30' : 'border-gray-100'} flex flex-col md:flex-row gap-8 items-start shadow-sm`}
          >
            <div className="w-full md:w-64 aspect-video md:aspect-square rounded-2xl overflow-hidden bg-gray-100 shrink-0">
              {hero.mediaType === 'video' ? (
                <video
                  src={hero.mediaUrl}
                  className="w-full h-full object-cover"
                  muted
                  autoPlay
                  loop
                />
              ) : (
                <img src={hero.mediaUrl} className="w-full h-full object-cover" alt="" />
              )}
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3 mb-2">
                {hero.isActive ? (
                  <span className="flex items-center gap-1 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                    <Check size={10} /> Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                    Inactive
                  </span>
                )}
                <span className="text-gray-400 text-xs">
                  Created {new Date(hero.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Hero Media #{hero._id.slice(-4)}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {hero.mediaType === 'video' ? <Film size={14} /> : <ImageIcon size={14} />}
                {hero.mediaType.toUpperCase()}
              </div>
            </div>

            <div className="flex md:flex-col gap-2 shrink-0">
              <button
                onClick={() => handleEdit(hero)}
                className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all"
                title="Edit"
              >
                <Edit2 size={18} />
              </button>
              <button
                onClick={() => setHeroToDelete(hero._id)}
                className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                title="Delete"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
        {heroes?.length === 0 && !isAdding && (
          <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400 font-medium">No heroes found. Add your first one!</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        title="Er du sikker?"
        description="Vil du virkelig slette denne heroen?"
        confirmText="Ja, slett"
        cancelText="Avbryt"
        variant="destructive"
        isOpen={!!heroToDelete}
        onOpenChange={(open) => !open && setHeroToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default HomeHeroPage;
