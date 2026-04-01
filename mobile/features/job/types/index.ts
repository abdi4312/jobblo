export interface Job {
    _id: string;
    userId: {
        _id: string;
        name: string;
    };
    title: string;
    description: string;
    price: number;
    location: {
        type: string;
        coordinates: number[];
        address: string;
        city: string;
    };
    categories: string[];
    images: string[];
    urgent: boolean;
    status: 'open' | 'closed' | 'in_progress';
    tags: string[];
    createdAt: string;
}

export interface JobsResponse {
    data: Job[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}
