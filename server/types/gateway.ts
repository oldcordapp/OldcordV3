export interface GatewayPayload<T = unknown> {
  op: number;
  d: T;
  s?: number | null;
  t?: string;
}
