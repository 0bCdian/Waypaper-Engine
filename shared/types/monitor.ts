export interface wlr_randr_monitor {
    name: string;
    description: string;
    make: string;
    model: string;
    serial: string;
    physical_size: {
        width: number;
        height: number;
    };
    enabled: boolean;
    modes: Array<{
        width: number;
        height: number;
        refresh: number;
        preferred: boolean;
        current: boolean;
    }>;
    position: {
        x: number;
        y: number;
    };
    transform: string;
    scale: number;
    adaptive_sync: boolean;
}

export type wlr_output = wlr_randr_monitor[];

export interface Monitor {
    name: string;
    width: number;
    height: number;
    currentImage: string;
    position: number;
}
