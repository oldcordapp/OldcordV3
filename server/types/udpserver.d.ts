interface Encryption {
  mode: string;
  key: number[];
}

interface Session {
  ip_addr: string;
  ip_port: number;
  encryption_mode: string;
  encryption_key: number[];
}
