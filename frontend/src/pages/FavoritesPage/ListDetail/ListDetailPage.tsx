import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MoreHorizontal,
  ChevronDown,
  Globe,
  Lock,
  UserPlus,
  Users,
  Trash2,
  Edit3,
  ArrowLeft
} from "lucide-react";
import { useFavoriteList, useUpdateFavoriteList, useDeleteFavoriteList } from "../../../features/favoriteLists/hooks";
import { useUserStore } from "../../../stores/userStore";
import { JobCard } from "../../../components/Explore/jobs/JobCard";
import Swal from "sweetalert2";
import EditListModal from "./EditListModal";
import AddContributorModal from "./AddContributorModal";
import ContributorsModal from "./ContributorsModal";

export const ListDetailPage: React.FC = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const { data: list, isLoading } = useFavoriteList(listId!);
  const updateListMutation = useUpdateFavoriteList();
  const deleteListMutation = useDeleteFavoriteList();
  const currentUser = useUserStore((state) => state.user);

  // Check if current user is owner by matching their ID with list.user array
  const isOwner = list?.user?.some((u: any) => u._id === currentUser?._id);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddContributorModal, setShowAddContributorModal] = useState(false);
  const [showContributorsModal, setShowContributorsModal] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortOrder, setSortOrder] = useState("Last added first");

  const sortOptions = ["Last added first", "Available first", "Sold first"];

  const sortedServices = React.useMemo(() => {
    if (!list?.services) return [];

    let services = [...list.services];

    if (sortOrder === "Last added first") {
      // The array in Mongoose is usually in the order added, so reverse it for "last added first"
      return services.reverse();
    } else if (sortOrder === "Available first") {
      return services.sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;
        return 0;
      });
    } else if (sortOrder === "Sold first") {
      return services.sort((a, b) => {
        if (a.status === 'closed' && b.status !== 'closed') return -1;
        if (a.status !== 'closed' && b.status === 'closed') return 1;
        return 0;
      });
    }

    return services;
  }, [list?.services, sortOrder]);

  if (isLoading) return <div className="p-20 text-center">Loading list...</div>;
  if (!list) return <div className="p-20 text-center">List not found.</div>;

  const handleMakePublic = async () => {
    await updateListMutation.mutateAsync({
      listId: list._id,
      data: { public: !list.public }
    });
  };

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: "Delete list?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EF4444",
      confirmButtonText: "Delete",
    });

    if (result.isConfirmed) {
      await deleteListMutation.mutateAsync(list._id);
      navigate("/favorites");
    }
  };

  const latestImage = list.services?.[list.services.length - 1]?.images?.[0];

  return (
    <div className="max-w-300 mx-auto p-6 min-h-screen animate-in fade-in duration-500">
      {/* Add Contributor Modal */}
      <AddContributorModal
        listId={list._id}
        isOpen={showAddContributorModal}
        onClose={() => setShowAddContributorModal(false)}
      />

      {/* Contributors List Modal */}
      <ContributorsModal
        list={list}
        isOpen={showContributorsModal}
        onClose={() => setShowContributorsModal(false)}
        onAddContributor={() => {
          setShowContributorsModal(false);
          setShowAddContributorModal(true);
        }}
      />

      {/* Edit List Modal */}
      <EditListModal
        list={list}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
      />

      {/* Back Button */}
      {/* <button
        onClick={() => navigate("/favorites")}
        className="mb-6 flex items-center gap-2 text-gray-500 hover:text-black transition-colors"
      >
        <ArrowLeft size={20} />
        <span className="font-medium">Back to favorites</span>
      </button> */}

      {/* Header Section */}
      <div className="flex flex-col bg-white p-6 rounded-3xl md:flex-row gap-8 items-start md:items-center ">
        {/* List Thumbnail */}
        <div className="w-48 h-48 rounded-4xl bg-gray-100 overflow-hidden shadow-md shrink-0">
          {latestImage ? (
            <img src={latestImage} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              No items
            </div>
          )}
        </div>

        {/* List Info */}
        <div className="flex-1 space-y-4">
          <h1 className="text-4xl font-bold text-[#0A0A0A]">{list.name}</h1>

          <div className="flex items-center gap-6 text-sm text-gray-500 font-medium">
            <span>{list.services?.length || 0} items</span>
            <span>0 followers</span>
            <span>{(list.user?.length || 0) + (list.contributors?.length || 0)} contributors</span>
          </div>

          <div className="flex items-center gap-3">
            {isOwner && (
              <button
                onClick={handleMakePublic}
                className={`px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95 ${list.public
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  : "bg-[#FF8A71] text-white hover:bg-[#ff7659]"
                  }`}
              >
                {list.public ? "Make private" : "Make public"}
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-all active:scale-95"
              >
                More <ChevronDown size={18} className={`transition-transform ${showMoreMenu ? 'rotate-180' : ''}`} />
              </button>

              {showMoreMenu && (
                <div className="absolute top-full mt-2 left-0 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in slide-in-from-top-2 duration-200">
                  {isOwner && (
                    <>
                      <button onClick={handleDelete} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-red-500 font-semibold transition-colors">
                        <Trash2 size={18} /> Delete list
                      </button>
                      <button
                        onClick={() => {
                          setShowEditModal(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-700 font-semibold transition-colors"
                      >
                        <Edit3 size={18} /> Edit name and description
                      </button>
                      <button onClick={handleMakePublic} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-700 font-semibold transition-colors">
                        {list.public ? <Lock size={18} /> : <Globe size={18} />}
                        {list.public ? "Make private" : "Make public"}
                      </button>
                      <button
                        onClick={() => {
                          setShowAddContributorModal(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-700 font-semibold transition-colors"
                      >
                        <UserPlus size={18} /> Add contributor
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setShowContributorsModal(true);
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-700 font-semibold transition-colors"
                  >
                    <Users size={18} /> Contributors
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-8">
        <div className="flex justify-end items-center mb-8 gap-4">
          <span className="text-[#0A0A0A] font-medium text-lg">Sort</span>
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-300 rounded-2xl font-bold text-base hover:bg-gray-50 transition-all active:scale-95"
            >
              {sortOrder} <ChevronDown size={20} className={`transition-transform duration-200 ${showSortMenu ? 'rotate-180' : ''}`} />
            </button>

            {showSortMenu && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-[24px] shadow-2xl border border-gray-100 py-3 z-[60] animate-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-2 flex items-center gap-2 text-gray-400 font-bold text-sm uppercase tracking-wider">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" />
                  </svg>
                  Sort by
                </div>
                <div className="mt-1">
                  {sortOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setSortOrder(option);
                        setShowSortMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors ${sortOrder === option
                        ? "bg-[#FFF0ED] text-[#FF8A71] font-bold"
                        : "hover:bg-gray-50 text-[#0A0A0A] font-semibold"
                        }`}
                    >
                      <span>{option}</span>
                      {sortOrder === option && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* List Items Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {sortedServices?.map((job: any) => (
            <JobCard key={job._id} job={job} />
          ))}
        </div>

        {list.services?.length === 0 && (
          <div className="py-20 text-center text-gray-400">
            <p className="text-lg font-medium">This list is empty</p>
          </div>
        )}
      </div>
    </div>
  );
};
