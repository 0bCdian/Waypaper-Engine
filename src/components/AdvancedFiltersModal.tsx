import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import { useEffect, useRef } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { parseResolution } from "../utils/utilities";
import type {
	advancedFilters,
	resolutionConstraints,
} from "../types/rendererTypes";
import type { Formats } from "../../shared/types/image";
import NeoCloseButton from "./NeoCloseButton";
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
	const { setFilters, filters } = useImagesStore(
		useShallow((s) => ({
			setFilters: s.setFilters,
			filters: s.filters,
		})),
	);
	const onSubmit: SubmitHandler<AdvancedFiltersForm> = (data) => {
		const { width, height, resolutionConstraint, ...formats } = data;
		const formatsArray: Formats[] = [];
		const { width: parsedWidth, height: parsedHeight } = parseResolution(
			`${width}x${height}`,
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
				constraint: resolutionConstraint,
			},
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
	}, [reset]);
	return (
		<dialog id="AdvancedFiltersModal" className="modal" ref={containerRef}>
			<div className="modal-box max-w-lg xl:max-w-xl 2xl:max-w-2xl">
				<NeoCloseButton onClick={() => containerRef.current?.close()} />
				<h2 className="mb-4 text-2xl xl:text-3xl 2xl:text-4xl font-bold">
					Advanced Filters
				</h2>

				<form
					method="dialog"
					className="flex flex-col gap-4 xl:gap-5 2xl:gap-6"
					onSubmit={(e) => {
						void handleSubmit(onSubmit)(e);
					}}
				>
					{/* Resolution constraint */}
					<fieldset className="fieldset bg-base-200 border border-base-300 rounded-box p-4 xl:p-5 2xl:p-6">
						<legend className="fieldset-legend text-base 2xl:text-lg">
							Resolution
						</legend>

						<label className="label cursor-pointer justify-between">
							<span className="text-sm xl:text-base 2xl:text-lg">
								Show all resolutions
							</span>
							<input
								defaultChecked
								value="all"
								type="radio"
								{...register("resolutionConstraint")}
								className="radio radio-primary"
							/>
						</label>
						<label className="label cursor-pointer justify-between">
							<span className="text-sm xl:text-base 2xl:text-lg">
								Exact resolution
							</span>
							<input
								type="radio"
								value="exact"
								{...register("resolutionConstraint")}
								className="radio radio-primary"
							/>
						</label>
						<label className="label cursor-pointer justify-between">
							<span className="text-sm xl:text-base 2xl:text-lg">
								Less than
							</span>
							<input
								type="radio"
								value="lessThan"
								{...register("resolutionConstraint")}
								className="radio radio-primary"
							/>
						</label>
						<label className="label cursor-pointer justify-between">
							<span className="text-sm xl:text-base 2xl:text-lg">
								Greater than
							</span>
							<input
								type="radio"
								value="moreThan"
								{...register("resolutionConstraint")}
								className="radio radio-primary"
							/>
						</label>

						<p className="label text-base-content/60 mt-2 text-xs xl:text-sm italic">
							A value of zero means all resolutions
						</p>

						<div className="mt-1 grid grid-cols-2 gap-3">
							<div>
								<label
									htmlFor="width"
									className="label text-sm xl:text-base font-medium"
								>
									Width
								</label>
								<input
									type="number"
									defaultValue={0}
									min={0}
									step={1}
									{...register("width")}
									id="width"
									className="input input-bordered xl:input-lg w-full"
								/>
							</div>
							<div>
								<label
									htmlFor="height"
									className="label text-sm xl:text-base font-medium"
								>
									Height
								</label>
								<input
									type="number"
									id="height"
									defaultValue={0}
									step={1}
									min={0}
									{...register("height")}
									className="input input-bordered xl:input-lg w-full"
								/>
							</div>
						</div>
					</fieldset>

					{/* Image formats */}
					<fieldset className="fieldset bg-base-200 border border-base-300 rounded-box p-4 xl:p-5 2xl:p-6">
						<legend className="fieldset-legend text-base 2xl:text-lg">
							Image Formats
						</legend>

						<label className="label cursor-pointer justify-between">
							<span className="font-medium text-sm xl:text-base 2xl:text-lg">
								Select / Deselect All
							</span>
							<input
								defaultChecked={true}
								onChange={(e) => {
									setFormatsValues(e.target.checked);
								}}
								type="checkbox"
								className="toggle toggle-primary"
							/>
						</label>

						<div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
							{(
								[
									["jpeg", "JPEG"],
									["jpg", "JPG"],
									["png", "PNG"],
									["webp", "WEBP"],
									["gif", "GIF"],
									["bmp", "BMP"],
									["tiff", "TIFF"],
									["tga", "TGA"],
									["pnm", "PNM"],
									["farbfeld", "FARBFELD"],
								] as const
							).map(([name, label]) => (
								<label
									key={name}
									className="label cursor-pointer justify-start gap-3"
								>
									<input
										defaultChecked
										type="checkbox"
										className="checkbox checkbox-sm xl:checkbox-md checkbox-primary"
										{...register(name)}
									/>
									<span className="text-sm xl:text-base">{label}</span>
								</label>
							))}
						</div>
					</fieldset>

					<button
						type="submit"
						className="btn btn-primary btn-block xl:btn-lg mt-2"
					>
						Save Filters
					</button>
				</form>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button type="button">close</button>
			</form>
		</dialog>
	);
};

export default AdvancedFiltersModal;
