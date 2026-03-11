interface UserStatsProps {
    user: {
        averageRating?: number;
        reviewCount?: number;
        earnings?: number;
        spending?: number;
        bio?: string;
        role?: string;
        subscription?: string;
    } | null;
}

export const UserStats = ({ user }: UserStatsProps) => {
    if (!user) return null;
    console.log("user.bio", user);

    const stats = [
        { label: "Rating", value: `${user.averageRating || 0}`, color: "text-[#2F7E47]" },
        { label: "Anmeldelser", value: user.reviewCount || 0, color: "text-[#2F7E47]" },
        { label: "Tjent", value: `${user.earnings || 0} kr`, color: "text-[#2F7E47]" },
        { label: "Brukt", value: `${user.spending || 0} kr`, color: "text-[#2F7E47]" },
    ];

    return (
        <div className="w-full flex justify-center items-center flex-col gap-4">
            {/* Stats Grid */}
            <div className="w-full grid mx-auto grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                    <div
                        key={i}
                        className="flex gap-2 flex-col bg-[#FFFFFF1A] md:max-w-69 max-h-24.75 justify-between rounded-[14px] p-6 shadow-sm"
                    >
                        <div className="text-sm text-[#2F7E47] font-medium">
                            {stat.label}
                        </div>

                        <div className={`text-[20px] font-bold text-[#0A0A0A] leading-9.5 flex justify-end items-end`}>
                            {stat.value}
                        </div>

                    </div>
                ))}
            </div>

            {/* Bio Section */}
            {user.bio && (
                <div className="flex flex-col gap-2.5 w-full px-6 py-5.5 bg-[#FFFFFF1A] rounded-xl shadow-sm">
                    <div className="font-medium text-[#2F7E47] text-sm mb-1 tracking-wide">Bio</div>
                    <p className="text-[#303030] text-sm font-medium leading-5">
                        {user.bio}
                    </p>
                </div>
            )}

            {/* Badges */}
            <div className="flex gap-2 flex-wrap w-full">
                {user.role && (
                    <span className="px-4 py-1.5 bg-[#2F7E47] text-white rounded-full text-xs font-bold capitalize shadow-sm border border-white/10">
                        {user.role}
                    </span>
                )}
                {user.subscription && (
                    <span className="px-4 py-1.5 bg-[#2F7E47] text-white rounded-full text-xs font-bold capitalize shadow-sm border border-white/10">
                        {user.subscription}
                    </span>
                )}
            </div>
        </div>
    );
};