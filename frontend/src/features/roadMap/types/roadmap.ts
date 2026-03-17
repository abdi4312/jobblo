export interface RoadmapFeature {
    _id: string;
    title: string;
    description: string;
    status: 'planned' | 'in-progress' | 'completed';
    tag: 'feature' | 'bugfix' | 'improvement' | 'security';
    progress: number;
    createdAt?: string;
    releaseDate?: string;
}

export type RoadmapFeatureInput = Omit<RoadmapFeature, '_id' | 'createdAt'>;
