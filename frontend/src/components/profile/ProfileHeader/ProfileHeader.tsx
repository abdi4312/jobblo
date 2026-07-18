import { useUserStore } from '../../../stores/userStore';
import {
  Star,
  Settings,
  MapPin,
  Pencil,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlockUser } from '../../../features/profile/hooks';
import { toast } from 'react-hot-toast';
import { BlockModal } from './BlockModal';
import type { User } from '../../../types/userTypes';
import { Button } from '../../Ui/button/Button';
import ConfirmDialog from '../../Ui/ConfirmDialog';

export function ProfileHeader({
  user,
  handlelogout,
  isOwnProfile = true,
  profileType = 'seeker',
}: {
  user: User | null;
  handlelogout: () => void;
  isOwnProfile?: boolean;
  profileType?: 'seeker' | 'poster';
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isUnblockModalOpen, setIsUnblockModalOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const navigate = useNavigate();
  const blockMutation = useBlockUser();
  const currentUser = useUserStore((state) => state.user);

  const isBlockedByMe = currentUser?.blockedUsers?.some(
    (id) => (typeof id === 'string' ? id : id._id)?.toString() === user?._id
  );

  const handleUnblock = () => {
    if (user?._id) {
      blockMutation.mutate(user._id, {
        onSuccess: () => {
          setIsUnblockModalOpen(false);
          toast.success(`Bruker opphevet blokkering`);
        },
      });
    }
  };

  const fullName =
    user?.role === 'company' ? user?.companyName : `${user?.name} ${user?.lastName || ''}`.trim();

  // Company Profile
  if (user?.role === 'company') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-black/5 overflow-hidden -mt-6 sm:-mt-8 relative z-10">
        {isBlockedByMe && (
          <div className="bg-red-50 py-3 text-center border-b border-red-100">
            <p className="text-[13px] sm:text-[14px] font-medium text-gray-900">Du har blokkert denne brukeren.</p>
            <button
              onClick={() => setIsUnblockModalOpen(true)}
              disabled={blockMutation.isPending}
              className="text-[13px] sm:text-[14px] font-bold text-red-500 hover:underline mt-0.5 disabled:opacity-50"
            >
              {blockMutation.isPending ? 'Opphever...' : 'Opphev blokkering'}
            </button>
          </div>
        )}

        {/* Banner */}
        <div className="relative h-28 sm:h-36 md:h-44 bg-gray-100">
          <img
            src={user?.bannerUrl || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200'}
            alt="Banner"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          {isOwnProfile && (
            <button
              onClick={() => navigate('/settings/banner')}
              className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 bg-white/90 backdrop-blur-sm p-1.5 sm:p-2 rounded-lg shadow-sm hover:bg-white transition-colors"
            >
              <Pencil size={13} className="text-gray-600" />
            </button>
          )}
        </div>

        {/* Profile Info */}
        <div className="px-4 sm:px-6 pb-4 sm:pb-5 -mt-8 sm:-mt-10 relative z-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-3 sm:gap-4">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-[3px] border-white bg-white shadow-md">
                <img
                  src={user?.avatarUrl || 'https://api.builder.io/api/v1/image/assets/TEMP/7278bc40eaffee1b3010ad41c4d262b59215cbf6?width=332'}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              {isOwnProfile && (
                <button
                  onClick={() => navigate('/settings/picture')}
                  className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Pencil size={14} className="text-white" />
                </button>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left pb-1 min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">{fullName}</h1>
                {(user as any)?.isTrusted && (
                  <span className="flex items-center gap-0.5 bg-[#e8f5e9] text-[#2e7d32] text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded">
                    <ShieldCheck size={10} /> TRUSTED
                  </span>
                )}
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 mt-0.5 sm:mt-1 text-[11px] sm:text-[13px] text-gray-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin size={12} /> {user?.postSted || 'Oslo'}
                </span>
                <span className="text-gray-300 hidden sm:inline">·</span>
                <span>{user?.averageRating != null ? user.averageRating.toFixed(1) : '0.0'} <Star size={10} className="inline text-amber-500" fill="currentColor" /></span>
                <span className="text-gray-300 hidden sm:inline">·</span>
                <span>{user?.reviewCount || 0} vurderinger</span>
              </div>
            </div>

            {/* Actions */}
            {isOwnProfile && (
              <div className="flex gap-1.5 sm:gap-2 pb-1">
                <Button
                  label="Rediger"
                  onClick={() => navigate('/settings')}
                  icon={<Pencil size={13} />}
                  className="rounded-lg font-medium px-3 sm:px-5 text-[11px] sm:text-[13px] cursor-pointer"
                />
                <div className="relative">
                  <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="bg-gray-100 hover:bg-gray-200 p-1.5 sm:p-2 rounded-lg transition-colors"
                  >
                    <Settings size={14} className="text-gray-500" />
                  </button>
                  {isMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl py-1 min-w-44 z-50">
                      <button
                        onClick={() => navigate('/settings/seeker')}
                        className="flex items-center w-full px-4 py-2 text-[13px] hover:bg-gray-50 text-gray-700"
                      >
                        <Settings size={13} className="mr-2" /> Innstillinger
                      </button>
                      <div className="h-px bg-gray-100 my-1" />
                      <ConfirmDialog
                        title="Logg ut?"
                        description="Vil du logge ut?"
                        confirmText="Ja, logg ut"
                        cancelText="Avbryt"
                        isOpen={showLogoutConfirm}
                        onOpenChange={setShowLogoutConfirm}
                        onConfirm={handlelogout}
                        trigger={
                          <button className="flex items-center w-full px-4 py-2 text-[13px] hover:bg-gray-50 text-red-500">
                            Logg ut
                          </button>
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <BlockModal
          user={user}
          isOpen={isBlockModalOpen}
          onClose={() => setIsBlockModalOpen(false)}
          onConfirm={() => {
            if (user?._id) {
              blockMutation.mutate(user._id, {
                onSuccess: (data) => {
                  setIsBlockModalOpen(false);
                  toast.success(data.message || `${user?.name} blocked`);
                },
              });
            }
          }}
          isPending={blockMutation.isPending}
          type="block"
        />

        <BlockModal
          user={user}
          isOpen={isUnblockModalOpen}
          onClose={() => setIsUnblockModalOpen(false)}
          onConfirm={handleUnblock}
          isPending={blockMutation.isPending}
          type="unblock"
        />
      </div>
    );
  }

  // Normal User Profile
  return (
    <div className="bg-white rounded-xl shadow-sm border border-black/5 p-4 sm:p-5 -mt-6 sm:-mt-8 relative z-10">
      {isBlockedByMe && (
        <div className="bg-red-50 py-3 text-center border-b border-red-100 mb-4 sm:mb-5 -mx-4 sm:-mx-5 -mt-4 sm:-mt-5 rounded-t-xl">
          <p className="text-[13px] sm:text-[14px] font-medium text-gray-900">Du har blokkert denne brukeren.</p>
          <button
            onClick={() => setIsUnblockModalOpen(true)}
            disabled={blockMutation.isPending}
            className="text-[13px] sm:text-[14px] font-bold text-red-500 hover:underline mt-0.5 disabled:opacity-50"
          >
            {blockMutation.isPending ? 'Opphever...' : 'Opphev blokkering'}
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4">
        {/* Avatar */}
        <div className="relative group shrink-0">
          <div className="w-[60px] h-[60px] sm:w-[72px] sm:h-[72px] rounded-full bg-[#c8d8c8] overflow-hidden flex items-center justify-center text-lg sm:text-xl font-medium text-[#1a3a1a]">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={fullName} className="w-full h-full object-cover" />
            ) : (
              user?.name?.[0] || 'U'
            )}
          </div>
          {user?.verified && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 sm:w-5 sm:h-5 bg-[#1a3a1a] rounded-full border-2 border-white flex items-center justify-center">
              <ShieldCheck size={8} className="text-white sm:hidden" />
              <ShieldCheck size={10} className="text-white hidden sm:block" />
            </div>
          )}
          {isOwnProfile && (
            <button
              onClick={() => navigate('/settings/picture')}
              className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <Pencil size={12} className="text-white sm:hidden" />
              <Pencil size={14} className="text-white hidden sm:block" />
            </button>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 text-center sm:text-left min-w-0">
          <div className="text-[10px] sm:text-[11px] text-[#1a3a1a] font-medium mb-0.5 tracking-wide">
            @{user?.name?.toLowerCase().replace(/\s+/g, '') || 'guest'}
          </div>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 mb-0.5 truncate">{fullName}</h1>
          <div className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-[11px] sm:text-[12px] text-gray-500">
            <span className="flex items-center gap-1">
              <MapPin size={11} />
              {typeof user?.postSted === 'object' ? user.postSted.city : user?.postSted || 'Oslo'}
            </span>
            <span className="text-gray-300">·</span>
            <span className="truncate">
              Medlem siden{' '}
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString('no-NO', { month: 'long', year: 'numeric' })
                : 'desember 2019'}
            </span>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center sm:justify-start gap-3 sm:gap-4 mt-2.5 sm:mt-3">
            {[
              { label: 'Fullførte', val: user?.completedJobs || 0 },
              { label: 'Rating', val: user?.averageRating != null ? user.averageRating.toFixed(1) : '0.0' },
              { label: 'Utlagte', val: user?.postedJobsCount || 0 },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-sm sm:text-base font-bold text-gray-900">{stat.val}</div>
                <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        {isOwnProfile && (
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={() => navigate('/settings/bio')}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#1a3a1a] text-white rounded-lg text-[11px] sm:text-[12px] font-medium flex items-center gap-1 sm:gap-1.5 hover:bg-[#254d25] transition-colors"
            >
              <Pencil size={12} className="sm:hidden" />
              <Pencil size={13} className="hidden sm:block" />
              <span className="hidden sm:inline">Rediger</span>
              <span className="sm:hidden">Endre</span>
            </button>
            <button
              onClick={() => navigate('/settings/seeker')}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-black/5 text-gray-600 rounded-lg text-[11px] sm:text-[12px] font-medium hover:bg-black/10 transition-colors"
            >
              <Settings size={12} className="sm:hidden" />
              <Settings size={13} className="hidden sm:block" />
            </button>
            <ConfirmDialog
              title="Logg ut?"
              description="Vil du logge ut?"
              confirmText="Ja, logg ut"
              cancelText="Avbryt"
              isOpen={showLogoutConfirm}
              onOpenChange={setShowLogoutConfirm}
              onConfirm={handlelogout}
              trigger={
                <button className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-black/5 text-red-500 rounded-lg text-[11px] sm:text-[12px] font-medium hover:bg-red-50 transition-colors">
                  Ut
                </button>
              }
            />
          </div>
        )}
      </div>

      <BlockModal
        user={user}
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        onConfirm={() => {
          if (user?._id) {
            blockMutation.mutate(user._id, {
              onSuccess: (data) => {
                setIsBlockModalOpen(false);
                toast.success(data.message || `${user?.name} blocked`);
              },
            });
          }
        }}
        isPending={blockMutation.isPending}
        type="block"
      />

      <BlockModal
        user={user}
        isOpen={isUnblockModalOpen}
        onClose={() => setIsUnblockModalOpen(false)}
        onConfirm={handleUnblock}
        isPending={blockMutation.isPending}
        type="unblock"
      />
    </div>
  );
}
