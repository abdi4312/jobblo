export interface User {
    _id: string;
    name: string;
    lastName?: string;
    email: string;
    role: string;
}

export interface AuthResponse {
    user: User;
    accessToken: string;
}
