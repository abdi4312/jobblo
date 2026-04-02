import { Job } from "../../job/types";

export interface List {
    _id: string;
    name: string;
    description?: string;
    user: string[];
    public: boolean;
    latestservice?: Job;
    services: string[] | Job[];
    contributors: string[];
    followers: string[];
    createdAt: string;
    updatedAt: string;
}
