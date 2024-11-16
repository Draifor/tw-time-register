interface rules {
  required: string;
}

export interface Field {
  name: string;
  type: string;
  label: string;
  rules?: rules;
}
