export interface Plan {
  _id: string;
  name: string;
  price: number;
  freeViews: number;
  pricePerExtraView: number;
  features: string[];
  type: "business" | "private";
  isActive: boolean;
  featuresText: string[];
  entitlements: {
    freeContact: number;
  };
}
