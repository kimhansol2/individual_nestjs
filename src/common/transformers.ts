export const lowerCase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.toLowerCase() : value;

export const emptyToUndef = ({ value }: { value: unknown }): unknown =>
  value === '' ? undefined : value;

export const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
