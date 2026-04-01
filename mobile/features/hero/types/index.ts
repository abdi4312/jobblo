export interface Hero {
    _id: string;
    title: string;
    subtitle?: string;
    buttonText?: string;
    buttonUrl?: string;
    footerText?: string;
    bgColor?: string;
    image: string;
    activeFrom: string;
    expireAt: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
