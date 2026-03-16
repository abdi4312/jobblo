export interface ProfileData {
  email: string;
  password?: string;
  phoneNumber: string;
  name: string;
  lastName: string;
  birthDate: string;
  gender: string;
  bio: string;
  address: string;
  postNumber: string;
  postSted: string;
  country: string;
  profileImage: string;
}

export type UserUpdatePayload = FormData | {
  [key: string]: string | number | boolean | undefined;
};