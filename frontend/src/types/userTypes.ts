export type User = {
  phone?: string;
  _id: string;
  name: string;
  email: string;
  password: string;
  avatarUrl?: string;
  role?: string;
  subscription?: string;
  verified?: true;
  followers?: User[];
  following?: User[];
  availability?: []; // Hva er dette?
  earnings?: number;
  spending?: number;
  oauthProviders?: [
    {
      provider: "google";
      providerId: "100416200428901255467";
      _id: "68d98d54a60a9dfeeaec8dc7";
    },
  ];
  createdAt?: "2025-09-28T19:32:36.745Z";
  updatedAt?: "2025-09-28T19:32:36.745Z";
  __v?: 0; // Hva er dette?
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
  logout: () => void;
};
