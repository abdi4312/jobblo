export interface LocationNode {
  type: 'county' | 'municipality' | 'area';
  code: string;
  name: string;
  children?: LocationNode[];
}

export interface LocationStats {
  counties: Record<string, number>;
  municipalities: Record<string, number>;
  areas: Record<string, number>;
}
