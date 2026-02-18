export interface Plan {
  _id: string;
  name: string;
  price: number;
  type: "business" | "private";
  isActive: boolean;
  featuresText: string[];
  entitlements: {
    freeContact: number;
  };
}
