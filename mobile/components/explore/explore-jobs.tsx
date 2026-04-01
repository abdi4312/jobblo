import React, { useImperativeHandle, forwardRef } from 'react';
import { View, Text, ActivityIndicator, FlatList } from 'react-native';
import { useInfiniteJobs } from '../../features/job/hooks/useInfiniteJobs';
import { Ionicons } from '@expo/vector-icons';
import JobCard from './job-card/index';

const ExploreJobs = forwardRef((props, ref) => {
    const {
        data,
        isLoading,
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteJobs({ limit: 10 });

    const jobs = data?.pages.flatMap((page) => page.data) || [];

    useImperativeHandle(ref, () => ({
        loadMore: () => {
            if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
            }
        }
    }));

    if (isLoading) {
        return (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator color="#E68A2E" size="large" style={{}} />
            </View>
        );
    }

    if (isError) {
        return (
            <View className="py-10 items-center px-4">
                <Text className="text-red-500 text-center">Failed to load jobs. Please try again later.</Text>
            </View>
        );
    }

    return (
        <View className="mb-10">
            {/* Title Section */}
            <View className="mb-6 px-4">
                <Text className="text-2xl font-normal text-[#000000]">Explore Jobs</Text>
                <Text className="text-[#9E9E9E] text-[12px] font-light mt-2">Find your next greatest opportunity with us</Text>
            </View>

            {/* Jobs Grid */}
            <View className="flex-row flex-wrap justify-between px-4 pb-10">
                {jobs.map((job) => (
                    <JobCard key={job._id} item={job} />
                ))}
            </View>

            {/* Load More Indicator */}
            {isFetchingNextPage && (
                <View className="py-4 items-center justify-center">
                    <ActivityIndicator color="#2D7A4D" size="large" />
                </View>
            )}

            {!hasNextPage && jobs.length > 0 && (
                <Text className="text-center text-gray-400 mt-6 italic">No more jobs to load</Text>
            )}

            {jobs.length === 0 && (
                <View className="py-20 items-center">
                    <Ionicons name="briefcase-outline" size={60} color="#ddd" />
                    <Text className="text-gray-400 mt-4 text-lg">No jobs found</Text>
                </View>
            )}
        </View>
    );
});

ExploreJobs.displayName = 'ExploreJobs';

export default ExploreJobs;
