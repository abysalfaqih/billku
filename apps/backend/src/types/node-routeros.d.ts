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
    connect(): Promise<void>;
    close(): void;
    write(command: string, params?: string[]): Promise<ApiSentence[]>;
  }
}