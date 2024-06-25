export interface Choice {
    name: string;
    message?: string;
    value?: unknown;
    hint?: string;
    role?: string;
    enabled?: boolean;
    disabled?: boolean | string;
    size: number;
    mtime: Date;
    atime: Date;
    sizeInMB: number;
}