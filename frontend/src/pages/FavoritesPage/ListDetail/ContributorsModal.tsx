import { X, Plus, User } from "lucide-react";
import { useRemoveContributor } from "../../../features/favoriteLists/hooks";

interface Contributor {
  _id: string;
  name?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
  username?: string;
}

interface List {
  _id: string;
  user?: Contributor[];
  contributors?: Contributor[];
}

interface ContributorsModalProps {
  list: List;
  isOpen: boolean;
  onClose: () => void;
  onAddContributor: () => void;
}

const ContributorsModal: React.FC<ContributorsModalProps> = ({
  list,
  isOpen,
  onClose,
  onAddContributor,
}) => {
  const removeContributorMutation = useRemoveContributor();

  if (!isOpen || !list) return null;

  const handleRemove = async (userId: string) => {
    try {
      await removeContributorMutation.mutateAsync({
        listId: list._id,
        userId,
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center p-6 border-b border-gray-100">
          <h2 className="text-[#0A0A0A] font-bold text-lg">Bidragsytere</h2>
          <button
            onClick={onClose}
            className="absolute right-6 p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 pt-0 max-h-[500px] overflow-y-auto flex flex-col">
          {/* Add Contributor Link */}
          <button
            onClick={onAddContributor}
            className="flex items-center gap-3 px-3 py-4 text-[#0A0A0A] font-bold hover:bg-gray-50 rounded-2xl transition-all mb-2"
          >
            <div className="w-12 h-12 rounded-full bg-[#2F7E4711] flex items-center justify-center text-[#2F7E47]">
              <Plus size={24} />
            </div>
            <span>Legg til bidragsyter</span>
          </button>

          <div className="space-y-4">
            {/* List Owner */}
            {list.user?.map((owner: Contributor) => (
              <div
                key={owner._id}
                className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-2xl transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden shrink-0 border border-gray-100 shadow-sm">
                    {owner.avatarUrl ? (
                      <img
                        src={owner.avatarUrl}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#2F7E47] bg-[#2F7E4711]">
                        <User size={20} />
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-[#0A0A0A] text-base leading-tight">
                      {owner.name} {owner.lastName}
                    </p>
                    <p className="text-sm text-gray-400 font-medium">
                      {owner.email || "Eier"}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs font-bold rounded-full uppercase tracking-wider">
                  Eier
                </span>
              </div>
            ))}

            {/* Other Contributors */}
            {list.contributors?.length > 0 ? (
              list.contributors.map((user: Contributor) => (
                <div
                  key={user._id}
                  className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-2xl transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden shrink-0 border border-gray-100 shadow-sm">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          className="w-full h-full object-cover"
                          alt=""
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#2F7E47] bg-[#2F7E4711]">
                          <User size={20} />
                        </div>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-[#0A0A0A] text-base leading-tight">
                        {user.name} {user.lastName}
                      </p>
                      <p className="text-sm text-gray-400 font-medium">
                        {user.email || user.username}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemove(user._id)}
                    disabled={removeContributorMutation.isPending}
                    className="px-6 py-2 border border-gray-300 rounded-2xl font-bold text-[#0A0A0A] hover:bg-gray-50 transition-all active:scale-[0.98]"
                  >
                    Fjern
                  </button>
                </div>
              ))
            ) : (
              <p className="text-center py-10 text-gray-400">
                Ingen bidragsytere ennå
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContributorsModal;
