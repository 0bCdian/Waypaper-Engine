import { imagesStore } from "../stores/images";
import { useEffect, useRef } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { parseResolution } from "../utils/utilities";
import {
    type advancedFilters,
    type resolutionConstraints
} from "../types/rendererTypes";
import { type Formats } from "../../shared/types/image";
interface AdvancedFiltersForm {
    resolutionConstraint: resolutionConstraints;
    width: string;
    height: string;
    jpeg: boolean;
    jpg: boolean;
    webp: boolean;
    gif: boolean;
    png: boolean;
    bmp: boolean;
    tiff: boolean;
    tga: boolean;
    pnm: boolean;
    farbfeld: boolean;
}

const AdvancedFiltersModal = () => {
    const { register, handleSubmit, setValue, reset } =
        useForm<AdvancedFiltersForm>();
    const containerRef = useRef<HTMLDialogElement>(null);
    const { setFilters, filters } = imagesStore();
    const onSubmit: SubmitHandler<AdvancedFiltersForm> = data => {
        const { width, height, resolutionConstraint, ...formats } = data;
        const formatsArray: Formats[] = [];
        const { width: parsedWidth, height: parsedHeight } = parseResolution(
            `${width}x${height}`
        );
        for (const key in formats) {
            if (formats[key as Formats]) {
                formatsArray.push(key as Formats);
            }
        }
        const advancedFilters: advancedFilters = {
            formats: formatsArray,
            resolution: {
                width: parsedWidth,
                height: parsedHeight,
                constraint: resolutionConstraint
            }
        };
        console.log(data, formatsArray, formats);
        setFilters({ ...filters, advancedFilters });
    };
    const setFormatsValues = (value: boolean) => {
        setValue("jpeg", value);
        setValue("png", value);
        setValue("farbfeld", value);
        setValue("bmp", value);
        setValue("webp", value);
        setValue("gif", value);
        setValue("tiff", value);
        setValue("tga", value);
        setValue("pnm", value);
        setValue("jpg", value);
    };

    useEffect(() => {
        reset();
    }, []);
    return (
        <dialog id="AdvancedFiltersModal" className="modal" ref={containerRef}>
            <div className="modal-box rounded-xl">
                <button
                    className="btn btn-circle btn-ghost absolute right-4 top-4"
                    onClick={() => {
                        containerRef.current?.close();
                    }}
                >
                    X
                </button>
                <form
                    method="dialog"
                    className="flex flex-col"
                    onSubmit={e => {
                        void handleSubmit(onSubmit)(e);
                    }}
                >
                    <h2 className="text-3xl">Resolution</h2>
                    <div className="divider my-2"></div>
                    <div>
                        <div className="form-control">
                            <label className="label cursor-pointer">
                                <span className="label-text text-xl">
                                    Show all resolutions
                                </span>
                                <input
                                    defaultChecked
                                    value={"all"}
                                    type="radio"
                                    {...register("resolutionConstraint")}
                                    className="radio checked:bg-blue-500"
                                />
                            </label>
                        </div>
                        <div className="form-control">
                            <label className="label cursor-pointer">
                                <span className="label-text text-xl">
                                    Filter by exact resolution
                                </span>
                                <input
                                    type="radio"
                                    value={"exact"}
                                    {...register("resolutionConstraint")}
                                    className="radio"
                                />
                            </label>
                        </div>
                        <div className="form-control">
                            <label className="label cursor-pointer">
                                <span className="label-text text-xl">
                                    Less than specified resolution
                                </span>
                                <input
                                    type="radio"
                                    value={"lessThan"}
                                    {...register("resolutionConstraint")}
                                    className="radio"
                                />
                            </label>
                        </div>
                        <div className="form-control">
                            <label className="label cursor-pointer">
                                <span className="label-text text-xl">
                                    More than specified resolution
                                </span>
                                <input
                                    type="radio"
                                    value={"moreThan"}
                                    {...register("resolutionConstraint")}
                                    className="radio"
                                />
                            </label>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <label className="label-text italic">
                            A value of zero means all resolutions
                        </label>
                        <div className="flex flex-col">
                            <label htmlFor="width" className="label">
                                <span className="label-text text-lg">
                                    Width
                                </span>
                            </label>
                            <input
                                type="number"
                                defaultValue={0}
                                min={0}
                                step={1}
                                {...register("width")}
                                id="width"
                                className="input input-info rounded-xl"
                            />
                        </div>
                        <div className="flex flex-col">
                            <label htmlFor="height" className="label">
                                <span className="label-text text-lg">
                                    Height
                                </span>
                            </label>
                            <input
                                type="number"
                                id="height"
                                defaultValue={0}
                                step={1}
                                min={0}
                                {...register("height")}
                                className="input input-info rounded-xl"
                            />
                        </div>
                    </div>
                    <div className="divider my-3"></div>
                    <h2 className="mb-3 text-3xl">Image formats</h2>
                    <label className="label cursor-pointer">
                        <span className="label-text text-2xl">
                            Select/Unselect All Formats
                        </span>
                        <input
                            defaultChecked={true}
                            onChange={e => {
                                setFormatsValues(e.target.checked);
                            }}
                            type="checkbox"
                            className="bg-neutral-focus h-5 w-9 appearance-none rounded-full shadow-inner transition-all duration-300 before:ml-0.5 before:inline-block before:h-4 before:w-4 before:rounded-full before:bg-blue-500 checked:bg-gray-300 checked:before:translate-x-full focus:outline-none"
                        />
                    </label>
                    <div className="form-control ml-10 max-h-[20vh] flex-wrap">
                        <label className="label cursor-pointer justify-start gap-5">
                            <input
                                defaultChecked
                                type="checkbox"
                                className="checkbox"
                                {...register("jpeg")}
                            />
                            <span className="label-text text-lg">JPEG</span>
                        </label>
                        <label className="label cursor-pointer justify-start gap-5">
                            <input
                                defaultChecked
                                type="checkbox"
                                className="checkbox"
                                {...register("jpg")}
                            />
                            <span className="label-text text-lg">JPG</span>
                        </label>
                        <label className="label cursor-pointer justify-start gap-5">
                            <input
                                defaultChecked
                                type="checkbox"
                                className="checkbox"
                                {...register("webp")}
                            />
                            <span className="label-text text-lg">WEBP</span>
                        </label>
                        <label className="label cursor-pointer justify-start gap-5">
                            <input
                                defaultChecked
                                type="checkbox"
                                className="checkbox"
                                {...register("gif")}
                            />
                            <span className="label-text justify-start gap-5 text-lg">
                                GIF
                            </span>
                        </label>
                        <label className="label cursor-pointer justify-start gap-5">
                            <input
                                defaultChecked
                                type="checkbox"
                                className="checkbox"
                                {...register("png")}
                            />
                            <span className="label-text text-lg">PNG</span>
                        </label>
                        <label className="label cursor-pointer justify-start gap-5">
                            <input
                                defaultChecked
                                type="checkbox"
                                className="checkbox"
                                {...register("bmp")}
                            />
                            <span className="label-text text-lg">BMP</span>
                        </label>
                        <label className="label cursor-pointer justify-start gap-5">
                            <input
                                defaultChecked
                                type="checkbox"
                                className="checkbox"
                                {...register("tiff")}
                            />
                            <span className="label-text text-lg">TIFF</span>
                        </label>
                        <label className="label cursor-pointer justify-start gap-5">
                            <input
                                defaultChecked
                                type="checkbox"
                                className="checkbox"
                                {...register("tga")}
                            />
                            <span className="label-text text-lg">TGA</span>
                        </label>
                        <label className="label cursor-pointer justify-start gap-5">
                            <input
                                defaultChecked
                                type="checkbox"
                                className="checkbox"
                                {...register("pnm")}
                            />
                            <span className="label-text text-lg">PNM</span>
                        </label>
                        <label className="label cursor-pointer justify-start gap-5">
                            <input
                                defaultChecked
                                type="checkbox"
                                className="checkbox"
                                {...register("farbfeld")}
                            />
                            <span className="label-text text-lg">FARBELD</span>
                        </label>
                    </div>
                    <div className="divider"></div>
                    <button className="btn btn-lg rounded-xl">
                        Save Filters
                    </button>
                </form>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button>close</button>
            </form>
        </dialog>
    );
};

export default AdvancedFiltersModal;
