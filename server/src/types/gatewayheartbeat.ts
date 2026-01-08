export interface GatewayHeartbeat {
    timeout: NodeJS.Timeout | null;
    start: () => void;
    reset: () => void;
    acknowledge: (d: any) => void;
};