import React, { useState } from "react";
import { Rocket, Clock, CheckCircle2, AlertCircle, ChevronRight, LayoutGrid, ShieldCheck, Zap } from "lucide-react";
import { useRoadmapFeatures } from "../../features/roadMap/hooks/useRoadmap";
import type { RoadmapFeature } from "../../features/roadMap/types/roadmap";

const UpcomingFeatures: React.FC = () => {
    const { data: features = [], isLoading: loading } = useRoadmapFeatures();
    const [filter, setFilter] = useState<'all' | 'planned' | 'in-progress' | 'completed'>('all');

    const filteredFeatures = filter === 'all'
        ? features
        : features.filter(f => f.status === filter);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle2 className="text-[#4CAF50]" size={20} />;
            case 'in-progress': return <Clock className="text-[#FF9800] animate-pulse" size={20} />;
            default: return <AlertCircle className="text-[#2196F3]" size={20} />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-[#4CAF501A] text-[#4CAF50]';
            case 'in-progress': return 'bg-[#FF98001A] text-[#FF9800]';
            default: return 'bg-[#2196F31A] text-[#2196F3]';
        }
    };

    const getTagIcon = (tag: string) => {
        switch (tag) {
            case 'feature': return <Rocket size={12} />;
            case 'bugfix': return <AlertCircle size={12} />;
            case 'improvement': return <LayoutGrid size={12} />;
            case 'security': return <ShieldCheck size={12} />;
            default: return <Zap size={12} />;
        }
    };

    return (
        <div className="min-h-screen pb-16 px-4 md:px-8">
            <div className="max-w-300 mx-auto">
                {/* Header Section */}
                <div className="text-center mb-20 space-y-6">
                    <div className="inline-flex items-center gap-2 px-5 py-2 bg-white border border-[#2F7E4720] text-[#2F7E47] rounded-full text-xs font-black tracking-widest uppercase shadow-sm">
                        <Rocket size={14} className="animate-bounce" />
                        Platform Roadmap
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-[#0F172A] tracking-tighter leading-none">
                        Our Road <span className="text-[#2F7E47] relative inline-block">Ahead.
                            <span className="absolute bottom-2 left-0 w-full h-3 bg-[#2F7E471A] -z-10 rotate-1"></span>
                        </span>
                    </h1>
                    <p className="text-xl text-[#64748B] max-w-2xl mx-auto font-semibold leading-relaxed">
                        Stay updated on the new features, improvements, and security updates we are currently working on.
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap justify-center gap-4 mb-16">
                    {['all', 'planned', 'in-progress', 'completed'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as 'all' | 'planned' | 'in-progress' | 'completed')}
                            className={`px-8 py-3.5 rounded-[20px] text-[13px] font-black tracking-wide transition-all duration-500 capitalize shadow-sm
                                ${filter === f
                                    ? 'bg-[#2F7E47] text-white shadow-[#2F7E4740] shadow-2xl translate-y-[-2px]'
                                    : 'bg-white text-[#64748B] hover:text-[#2F7E47] border border-[#E2E8F0] hover:border-[#2F7E4740]'
                                }`}
                        >
                            {f === 'all' ? 'All Updates' : f === 'in-progress' ? 'In Progress' : f === 'planned' ? 'Planned' : 'Completed'}
                        </button>
                    ))}
                </div>

                {/* Grid Layout or Loading */}
                {loading ? (
                    <div className="flex justify-center items-center py-24">
                        <div className="w-16 h-16 border-4 border-[#2F7E4720] border-t-[#2F7E47] rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredFeatures.length > 0 ? (
                            filteredFeatures.map((feature: RoadmapFeature) => (
                                <div
                                    key={feature._id}
                                    className="group bg-white rounded-[40px] p-10 border border-[#E2E8F0] hover:border-[#2F7E4720] transition-all duration-700 hover:shadow-[0_32px_64px_rgba(47,126,71,0.12)] flex flex-col items-start gap-6 relative overflow-hidden"
                                >
                                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#2F7E4705] to-transparent rounded-full -mr-16 -mt-16 transition-all duration-700 group-hover:scale-150 group-hover:from-[#2F7E4710]`}></div>

                                    <div className="flex justify-between items-center w-full relative z-10">
                                        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(feature.status).replace('bg-', 'bg-opacity-10 bg-')}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${feature.status === 'in-progress' ? 'animate-pulse' : ''} bg-current`}></span>
                                            {feature.status === 'in-progress' ? 'In Progress' : feature.status}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[#94A3B8] text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-[#F8FAFC] rounded-lg border border-[#F1F5F9]">
                                            {getTagIcon(feature.tag)}
                                            {feature.tag}
                                        </div>
                                    </div>

                                    <div className="space-y-3 relative z-10 w-full">
                                        <h3 className="text-2xl font-black text-[#0F172A] leading-tight transition-all duration-300 group-hover:text-[#2F7E47]">
                                            {feature.title}
                                        </h3>
                                        <p className="text-[#64748B] text-[15px] font-medium leading-relaxed max-h-[72px] overflow-hidden transition-all duration-500 group-hover:text-[#475569]">
                                            {feature.description}
                                        </p>
                                    </div>

                                    <div className="w-full space-y-3 mt-auto relative z-10">
                                        <div className="flex justify-between items-end">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Progress</p>
                                                <p className="text-xs font-black text-[#0F172A]">Upcoming update</p>
                                            </div>
                                            <div className="flex items-baseline gap-0.5">
                                                <span className="text-2xl font-black text-[#2F7E47] tabular-nums">{feature.progress}</span>
                                                <span className="text-xs font-black text-[#2F7E47] opacity-60">%</span>
                                            </div>
                                        </div>
                                        <div className="w-full h-3 bg-[#F1F5F9] rounded-full overflow-hidden p-0.5 ring-1 ring-[#F1F5F9]">
                                            <div
                                                className="h-full bg-gradient-to-r from-[#2F7E47] to-[#45B064] transition-all duration-[1500ms] cubic-bezier(0.4, 0, 0.2, 1) rounded-full shadow-[0_0_12px_rgba(47,126,71,0.2)]"
                                                style={{ width: `${feature.progress}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between w-full pt-6 border-t border-[#F1F5F9] relative z-10 mt-2">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-[#F8FAFC] rounded-2xl group-hover:bg-[#2F7E4708] transition-colors duration-500">
                                                {getStatusIcon(feature.status)}
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Estimate</p>
                                                <p className="text-[11px] font-bold text-[#0F172A]">Q2 2024</p>
                                            </div>
                                        </div>
                                        <div className="p-2 rounded-full border border-[#F1F5F9] group-hover:border-[#2F7E4720] transition-all duration-500 group-hover:translate-x-1">
                                            <ChevronRight size={16} className="text-[#94A3B8] group-hover:text-[#2F7E47]" />
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full py-32 text-center bg-white rounded-[40px] border-2 border-dashed border-[#E2E8F0]">
                                <LayoutGrid className="mx-auto text-[#CBD5E1] mb-4" size={48} />
                                <p className="text-xl font-bold text-[#64748B]">No planned updates at the moment.</p>
                                <p className="text-[#94A3B8] mt-2 font-medium">We'll be back soon with more exciting news!</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpcomingFeatures;
