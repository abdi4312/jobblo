export interface Hero {
  _id: string;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonUrl: string;
  footerText: string;
  bgColor: string;
  image: string;
  activeFrom: string;
  expireAt: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateHeroDTO {
  title: string;
  subtitle?: string;
  buttonText?: string;
  buttonUrl?: string;
  footerText?: string;
  bgColor?: string;
  image: File | string;
  activeFrom: string;
  expireAt: string;
}

export interface UpdateHeroDTO extends Partial<CreateHeroDTO> {
  _id: string;
}
