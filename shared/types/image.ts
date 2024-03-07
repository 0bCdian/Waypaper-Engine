export type Formats =
    | 'jpg'
    | 'jpeg'
    | 'png'
    | 'bmp'
    | 'gif'
    | 'webp'
    | 'farbeld'
    | 'pnm'
    | 'tga'
    | 'tiff';

export interface Image {
    id: number;
    name: string;
    isChecked: boolean;
    isSelected: boolean;
    width: number;
    height: number;
    format: Formats;
    time: number;
}
