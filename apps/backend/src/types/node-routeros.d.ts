declare module 'node-routeros' {
  export interface RouterOSAPIOptions {
    host: string;
    port?: number;
    user: string;
    password: string;
    timeout?: number;
    tls?: boolean;
  }

  export type ApiSentence = Record<string, string>;

  export class RouterOSAPI {
    constructor(options: RouterOSAPIOptions);
    /** Soket/penghubung di bawahnya; null setelah koneksi ditutup. */
    connector?: { destroy(): void } | null;
    connect(): Promise<void>;
    close(): void;
    on(event: string, listener: (...args: any[]) => void): this;
    write(command: string, params?: string[]): Promise<ApiSentence[]>;
  }
}