import axios, { AxiosError } from 'axios';

function safeStringify(v: unknown): string {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function hasMessage(x: unknown): x is { message: string } {
  return (
    typeof x === 'object' &&
    x !== null &&
    'message' in x &&
    typeof (x as { message?: unknown }).message === 'string'
  );
}

export function errMsg(e: unknown) {
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  if (hasMessage(e)) return e.message;
  return safeStringify(e);
}

export function axiosDetail(e: AxiosError<unknown>): string {
  const status = e.response?.status ?? 'no status';
  const code = e.code ?? '';
  const url = e.config?.url ?? '';
  const body = safeStringify(e.response?.data);
  return `[${status} ${code}] ${url} ${body}`.trim();
}

export function errorSummary(e: unknown): string {
  return axios.isAxiosError(e)
    ? axiosDetail(e as AxiosError<unknown>)
    : errMsg(e);
}
