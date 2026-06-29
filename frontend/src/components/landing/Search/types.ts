export interface CategoryResult {
  _id: string;
  name: string;
  icon: string;
}

export interface UserResult {
  _id: string;
  name: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface JobResult {
  _id: string;
  title: string;
  description?: string;
  price: number;
  userId?: UserResult;
}

export interface ListResult {
  _id: string;
  name: string;
  public?: boolean;
  services?: {
    images?: string[];
  }[];
}

export interface UnifiedSearchResults {
  categories: {
    results: CategoryResult[];
    total: number;
  };
  people: {
    results: UserResult[];
    total: number;
  };
  jobs: {
    results: JobResult[];
    total: number;
  };
  lists: {
    results: ListResult[];
    total: number;
  };
}
