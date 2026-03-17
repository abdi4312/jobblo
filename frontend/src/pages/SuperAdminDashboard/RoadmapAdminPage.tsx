import React, { useState } from "react";
import { ListPlus, Trash2, Edit3, Loader2, X } from "lucide-react";
import Swal from "sweetalert2";
import { useRoadmapFeatures, useCreateRoadmapFeature, useUpdateRoadmapFeature, useDeleteRoadmapFeature } from "../../features/roadMap/hooks/useRoadmap";
import type { RoadmapFeature, RoadmapFeatureInput } from "../../features/roadMap/types/roadmap";

const RoadmapAdminPage = () => {
    const { data: features = [], isLoading: loading } = useRoadmapFeatures();
    const createMutation = useCreateRoadmapFeature();
    const updateMutation = useUpdateRoadmapFeature();
    const deleteMutation = useDeleteRoadmapFeature();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFeature, setEditingFeature] = useState<RoadmapFeature | null>(null);

    const [formData, setFormData] = useState<RoadmapFeatureInput>({
        title: "",
        description: "",
        status: "planned",
        tag: "feature",
        progress: 0
    });

    const handleOpenModal = (feature: RoadmapFeature | null = null) => {
        if (feature) {
            setEditingFeature(feature);
            setFormData({
                title: feature.title,
                description: feature.description,
                status: feature.status,
                tag: feature.tag,
                progress: feature.progress
            });
        } else {
            setEditingFeature(null);
            setFormData({
                title: "",
                description: "",
                status: "planned",
                tag: "feature",
                progress: 0
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingFeature) {
                await updateMutation.mutateAsync({ id: editingFeature._id, data: formData });
                Swal.fire("Success!", "Feature updated.", "success");
            } else {
                await createMutation.mutateAsync(formData);
                Swal.fire("Success!", "New feature added.", "success");
            }
            setIsModalOpen(false);
        } catch (err: any) {
            Swal.fire("Error", err.response?.data?.error || "Action failed", "error");
        }
    };

    const handleDelete = async (id: string) => {
        const result = await Swal.fire({
            title: "Are you sure?",
            text: "You cannot undo this!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            confirmButtonText: "Yes, delete it!"
        });

        if (result.isConfirmed) {
            try {
                await deleteMutation.mutateAsync(id);
                Swal.fire("Deleted!", "Feature has been removed.", "success");
            } catch (err) {
                Swal.fire("Error", "Deletion failed", "error");
            }
        }
    };

    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Roadmap Management</h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-[#2d4a3e] text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 hover:bg-[#1e332a] transition-all shadow-lg active:scale-95"
                >
                    <ListPlus size={18} />
                    <span className="font-bold text-sm">Add New Entry</span>
                </button>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-[#2d4a3e]" size={40} />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-gray-400 text-[11px] font-black uppercase tracking-widest border-b border-gray-50">
                                    <th className="pb-4 px-4 font-black">Feature</th>
                                    <th className="pb-4 px-4 font-black">Status</th>
                                    <th className="pb-4 px-4 font-black">Tag</th>
                                    <th className="pb-4 px-4 font-black">Progress</th>
                                    <th className="pb-4 px-4 font-black text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {features.map((feature: RoadmapFeature) => (
                                    <tr key={feature._id} className="group hover:bg-gray-50/50 transition-colors">
                                        <td className="py-5 px-4">
                                            <p className="font-bold text-gray-800 text-sm mb-1">{feature.title}</p>
                                            <p className="text-[11px] text-gray-400 line-clamp-1 max-w-xs">{feature.description}</p>
                                        </td>
                                        <td className="py-5 px-4 uppercase text-[10px] font-black">
                                            <span className={`px-2 py-1 rounded-md ${feature.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                feature.status === 'in-progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {feature.status}
                                            </span>
                                        </td>
                                        <td className="py-5 px-4 uppercase text-[10px] font-black text-gray-400 italic">
                                            {feature.tag}
                                        </td>
                                        <td className="py-5 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
                                                    <div
                                                        className="h-full bg-[#2d4a3e] rounded-full"
                                                        style={{ width: `${feature.progress}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-[11px] font-bold text-gray-800">{feature.progress}%</span>
                                            </div>
                                        </td>
                                        <td className="py-5 px-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(feature)}
                                                    className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-blue-600 transition-all border border-transparent hover:border-blue-50"
                                                    title="Edit feature"
                                                    aria-label="Edit feature"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(feature._id)}
                                                    className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-red-600 transition-all border border-transparent hover:border-red-50"
                                                    title="Delete feature"
                                                    aria-label="Delete feature"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-4xl w-full max-w-lg overflow-hidden shadow-2xl scale-in-center">
                        <div className="bg-[#2d4a3e] p-8 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold tracking-tight">
                                    {editingFeature ? "Edit Feature" : "Add New Feature"}
                                </h3>
                                <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mt-1">Roadmap entry</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                title="Close modal"
                                aria-label="Close modal"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">Title</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-[#2d4a3e]/10 outline-none"
                                        placeholder="E.g. Chat Improvements"
                                        title="Feature title"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">Description</label>
                                    <textarea
                                        required
                                        rows={3}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 text-sm font-bold focus:ring-2 focus:ring-[#2d4a3e]/10 outline-none"
                                        placeholder="Detailed description..."
                                        title="Feature description"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">Status</label>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 text-sm font-bold outline-none"
                                            title="Select status"
                                        >
                                            <option value="planned">Planned</option>
                                            <option value="in-progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">Tag</label>
                                        <select
                                            value={formData.tag}
                                            onChange={(e) => setFormData({ ...formData, tag: e.target.value as any })}
                                            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 text-sm font-bold outline-none"
                                            title="Select tag"
                                        >
                                            <option value="feature">Feature</option>
                                            <option value="bugfix">Bugfix</option>
                                            <option value="improvement">Improvement</option>
                                            <option value="security">Security</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">Progress</label>
                                        <span className="text-[11px] font-black text-[#2d4a3e]">{formData.progress}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={formData.progress}
                                        onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) })}
                                        className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#2d4a3e]"
                                        title="Feature progress"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-[#2d4a3e] text-white py-4 rounded-2xl font-black shadow-xl shadow-green-900/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isSubmitting ? "Checking..." : editingFeature ? "Update Feature" : "Add Feature"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoadmapAdminPage;
