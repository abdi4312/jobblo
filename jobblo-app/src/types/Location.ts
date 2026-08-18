/**
 * Location hierarchy types for county/municipality/area filtering.
 * Matches backend location tree structure.
 */

export interface LocationNode {
  code: string;
  name: string;
  type: 'county' | 'municipality' | 'area';
  children?: LocationNode[];
}
