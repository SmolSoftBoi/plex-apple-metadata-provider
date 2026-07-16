export interface Cache {
  close(): void;
  delete(key: string): void;
  get(key: string): string | undefined;
  prune(): number;
  set(key: string, value: string, ttlSeconds: number): void;
}
