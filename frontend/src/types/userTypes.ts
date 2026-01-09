export type User = {
  phone?: string;
  _id: string;
  name: string;
  lastName?: string;
  email: string;
  password: string;
  avatarUrl?: string;
  bio?: string;
  role?: string;
  subscription?: string;
  verified?: boolean;
  birthDate?: string;
  gender?: string;
  address?: string;
  postNumber?: string;
  postSted?: string;
  country?: string;
  followers?: User[];
  following?: User[];
  availability?: []; // Hva er dette?
  earnings?: number;
  spending?: number;
  accountStatus?: string;
  averageRating?: number;
  reviewCount?: number;
  favorites?: string[];
  oauthProviders?: [
    {
      provider: "google";
      providerId: "100416200428901255467";
      _id: "68d98d54a60a9dfeeaec8dc7";
    },
  ];
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
};

export type UserState = {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;

  setUser: (user: User) => void;
  setTokens: (tokens: AuthTokens) => void;

  login: (user: User, tokens: AuthTokens) => void;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
};
