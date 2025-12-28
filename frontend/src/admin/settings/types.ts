export type FeatureToggle = {
  name: string;
  value: boolean;
  mutable: boolean;
  last_changed_at?: string;
  last_changed_by?: string;
};
