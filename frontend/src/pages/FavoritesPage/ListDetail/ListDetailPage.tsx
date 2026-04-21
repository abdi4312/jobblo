import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Globe,
  Lock,
  UserPlus,
  Users,
  Trash2,
  Edit3,
} from "lucide-react";
import {
  useFavoriteList,
  useUpdateFavoriteList,
  useDeleteFavoriteList,
  useToggleFollowList,
} from "../../../features/favoriteLists/hooks";
import { useUserStore } from "../../../stores/userStore";
import { JobCard } from "../../../components/component/jobCard/JobCard";
import Swal from "sweetalert2";
import { toast } from "react-hot-toast";
import EditListModal from "./EditListModal";
import AddContributorModal from "./AddContributorModal";
import ContributorsModal from "./ContributorsModal";

export const ListDetailPage: React.FC = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const { data: list, isLoading } = useFavoriteList(listId!);
  const updateListMutation = useUpdateFavoriteList();
  const deleteListMutation = useDeleteFavoriteList();
  const toggleFollowMutation = useToggleFollowList();
  const currentUser = useUserStore((state) => state.user);

  // Check if current user is owner (it's an array in the model)
  const isOwner = list?.user?.some(
    (u) => ((u as { _id?: string })._id || u) === currentUser?._id,
  );

  // Check if following
  const isFollowing = list?.followers?.some(
    (u) => ((u as { _id?: string })._id || u) === currentUser?._id,
  );

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddContributorModal, setShowAddContributorModal] = useState(false);
  const [showContributorsModal, setShowContributorsModal] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortOrder, setSortOrder] = useState("Sist lagt til");

  const sortOptions = ["Sist lagt til", "Tilgjengelige først", "Solgte først"];

  const sortedServices = React.useMemo(() => {
    if (!list?.services) return [];

    const services = [...list.services];

    if (sortOrder === "Sist lagt til") {
      // The array in Mongoose is usually in the order added, so reverse it for "last added first"
      return services.reverse();
    } else if (sortOrder === "Tilgjengelige først") {
      return services.sort((a, b) => {
        if (a.status === "open" && b.status !== "open") return -1;
        if (a.status !== "open" && b.status === "open") return 1;
        return 0;
      });
    } else if (sortOrder === "Solgte først") {
      return services.sort((a, b) => {
        if (a.status === "closed" && b.status !== "closed") return -1;
        if (a.status !== "closed" && b.status === "closed") return 1;
        return 0;
      });
    }

    return services;
  }, [list?.services, sortOrder]);

  if (isLoading) return <div className="p-20 text-center">Laster liste...</div>;
  if (!list) return <div className="p-20 text-center">Liste ikke funnet.</div>;

  const handleMakePublic = async () => {
    await updateListMutation.mutateAsync({
      listId: list._id,
      data: { public: !list.public },
    });
  };

  const handleFollowToggle = async () => {
    if (!currentUser) {
      toast.error("Vennligst logg inn for å følge lister");
      return;
    }
    await toggleFollowMutation.mutateAsync(list._id);
  };

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: "Slette liste?",
      text: "Denne handlingen kan ikke angres.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#EF4444",
      confirmButtonText: "Slett",
      cancelButtonText: "Avbryt",
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

      {/* Header Section */}
      <div className="flex flex-col bg-white p-6 rounded-3xl md:flex-row gap-8 items-start md:items-center ">
        {/* List Thumbnail */}
        <div className="w-48 h-48 rounded-4xl bg-gray-100 overflow-hidden shadow-md shrink-0">
          {latestImage ? (
            <img
              src={latestImage}
              className="w-full h-full object-cover"
              alt=""
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              Ingen elementer
            </div>
          )}
        </div>

        {/* List Info */}
        <div className="flex-1 space-y-4">
          <h1 className="text-4xl font-bold text-[#0A0A0A]">{list.name}</h1>

          <div className="flex items-center gap-6 text-sm text-gray-500 font-medium">
            <span>{list.services?.length || 0} elementer</span>
            <span>{list.followers?.length || 0} følgere</span>
            <span>
              {(list.user?.length || 0) + (list.contributors?.length || 0)}{" "}
              bidragsytere
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isOwner ? (
              <>
                <button
                  onClick={handleMakePublic}
                  className={`px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95 ${
                    list.public
                      ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      : "bg-[#2F7E47] text-white hover:bg-[#2F7E47]"
                  }`}
                >
                  {list.public ? "Gjør privat" : "Gjør offentlig"}
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-all active:scale-95"
                  >
                    Mer{" "}
                    <ChevronDown
                      size={18}
                      className={`transition-transform ${showMoreMenu ? "rotate-180" : ""}`}
                    />
                  </button>

                  {showMoreMenu && (
                    <div className="absolute top-full mt-2 left-0 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in slide-in-from-top-2 duration-200">
                      <button
                        onClick={handleDelete}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-red-500 font-semibold transition-colors"
                      >
                        <Trash2 size={18} /> Slett liste
                      </button>
                      <button
                        onClick={() => {
                          setShowEditModal(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-700 font-semibold transition-colors"
                      >
                        <Edit3 size={18} /> Rediger navn og beskrivelse
                      </button>
                      <button
                        onClick={handleMakePublic}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-700 font-semibold transition-colors"
                      >
                        {list.public ? <Lock size={18} /> : <Globe size={18} />}
                        {list.public ? "Gjør privat" : "Gjør offentlig"}
                      </button>
                      <button
                        onClick={() => {
                          setShowAddContributorModal(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-700 font-semibold transition-colors"
                      >
                        <UserPlus size={18} /> Legg til bidragsyter
                      </button>
                      <button
                        onClick={() => {
                          setShowContributorsModal(true);
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-700 font-semibold transition-colors"
                      >
                        <Users size={18} /> Bidragsytere
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={handleFollowToggle}
                disabled={toggleFollowMutation.isPending}
                className={`px-8 py-2.5 rounded-xl font-bold transition-all active:scale-95 shadow-sm ${
                  isFollowing
                    ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    : "bg-[#2F7E47] text-white hover:bg-[#2F7E47]"
                }`}
              >
                {toggleFollowMutation.isPending
                  ? "..."
                  : isFollowing
                    ? "Følger"
                    : "Følg"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-8">
        <div className="flex justify-end items-center mb-8 gap-4">
          <span className="text-[#0A0A0A] font-medium text-lg">Sorter</span>
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-300 rounded-2xl font-bold text-base hover:bg-gray-50 transition-all active:scale-95"
            >
              {sortOrder}{" "}
              <ChevronDown
                size={20}
                className={`transition-transform duration-200 ${showSortMenu ? "rotate-180" : ""}`}
              />
            </button>

            {showSortMenu && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-[24px] shadow-2xl border border-gray-100 py-3 z-[60] animate-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-2 flex items-center gap-2 text-gray-400 font-bold text-sm uppercase tracking-wider">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m3 16 4 4 4-4" />
                    <path d="M7 20V4" />
                    <path d="m21 8-4-4-4 4" />
                    <path d="M17 4v16" />
                  </svg>
                  Sorter etter
                </div>
                {sortOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setSortOrder(option);
                      setShowSortMenu(false);
                    }}
                    className={`w-full text-left px-4 py-3.5 text-base font-bold transition-colors ${
                      sortOrder === option
                        ? "text-[#2F7E47] bg-[#2F7E4711]"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* List Items Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {sortedServices?.map((job) => (
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
