import { Job } from "../../job/types";

export interface ListUser {
    _id: string;
    name: string;
    lastName?: string;
    avatarUrl?: string;
    email: string;
}

export interface List {
    _id: string;
    name: string;
    description?: string;
    user: string[] | ListUser[];
    public: boolean;
    latestservice?: Job;
    services: string[] | Job[];
    contributors: string[] | ListUser[];
    followers: string[] | ListUser[];
    createdAt: string;
    updatedAt: string;
}
