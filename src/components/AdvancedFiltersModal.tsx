import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import { useEffect, useRef } from "react";
import { useForm } from "@tanstack/react-form";
import { parseResolution } from "../utils/utilities";
import type {
	advancedFilters,
	resolutionConstraints,
} from "../types/rendererTypes";
import type { Formats } from "../../shared/types/image";
import Modal, { type ModalHandle } from "./Modal";
import { useModalStore } from "../stores/modalStore";

const FORMAT_KEYS = [
	"jpeg", "jpg", "png", "webp", "gif", "bmp", "tiff", "tga", "pnm", "farbfeld",
] as const;

type FormatKey = (typeof FORMAT_KEYS)[number];

const AdvancedFiltersModal = () => {
	const containerRef = useRef<ModalHandle>(null);

	useEffect(() => {
		if (containerRef.current) {
			useModalStore.getState().register("AdvancedFiltersModal", containerRef.current);
		}
		return () => useModalStore.getState().unregister("AdvancedFiltersModal");
	}, []);

	const { setFilters, filters } = useImagesStore(
		useShallow((s) => ({
			setFilters: s.setFilters,
			filters: s.filters,
		})),
	);

	const form = useForm({
		defaultValues: {
			resolutionConstraint: "all" as resolutionConstraints,
			width: "0",
			height: "0",
			jpeg: true,
			jpg: true,
			webp: true,
			gif: true,
			png: true,
			bmp: true,
			tiff: true,
			tga: true,
			pnm: true,
			farbfeld: true,
		},
		onSubmit: ({ value }) => {
			const { width, height, resolutionConstraint, ...formats } = value;
			const formatsArray: Formats[] = [];
			const { width: parsedWidth, height: parsedHeight } = parseResolution(
				`${width}x${height}`,
			);
			for (const key in formats) {
				if (formats[key as FormatKey]) {
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
				colors: filters.advancedFilters.colors ?? [],
			};
			setFilters({ ...filters, advancedFilters });
		},
	});

	const setFormatsValues = (value: boolean) => {
		for (const key of FORMAT_KEYS) {
			form.setFieldValue(key, value);
		}
	};

	return (
		<Modal id="AdvancedFiltersModal" ref={containerRef} className="modal-box max-w-lg xl:max-w-xl 2xl:max-w-2xl">
				<h2 className="mb-4 text-2xl xl:text-3xl 2xl:text-4xl font-bold">
					Advanced Filters
				</h2>

				<form
					method="dialog"
					className="flex flex-col gap-4 xl:gap-5 2xl:gap-6"
					onSubmit={(e) => {
						e.preventDefault();
						void form.handleSubmit();
					}}
				>
					<fieldset className="fieldset bg-base-200 border border-base-300 rounded-box p-4 xl:p-5 2xl:p-6">
						<legend className="fieldset-legend text-base 2xl:text-lg">
							Resolution
						</legend>

						<form.Field name="resolutionConstraint">
							{(field) => (
								<>
									{(
										[
											["all", "Show all resolutions"],
											["exact", "Exact resolution"],
											["lessThan", "Less than"],
											["moreThan", "Greater than"],
										] as const
									).map(([val, label]) => (
										<label key={val} className="label cursor-pointer justify-between">
											<span className="text-sm xl:text-base 2xl:text-lg">
												{label}
											</span>
											<input
												type="radio"
												value={val}
												checked={field.state.value === val}
												onChange={() => field.handleChange(val)}
												className="radio radio-primary"
											/>
										</label>
									))}
								</>
							)}
						</form.Field>

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
								<form.Field name="width">
									{(field) => (
										<input
											type="number"
											min={0}
											step={1}
											id="width"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											className="input input-bordered xl:input-lg w-full"
										/>
									)}
								</form.Field>
							</div>
							<div>
								<label
									htmlFor="height"
									className="label text-sm xl:text-base font-medium"
								>
									Height
								</label>
								<form.Field name="height">
									{(field) => (
										<input
											type="number"
											id="height"
											step={1}
											min={0}
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											className="input input-bordered xl:input-lg w-full"
										/>
									)}
								</form.Field>
							</div>
						</div>
					</fieldset>

					<fieldset className="fieldset bg-base-200 border border-base-300 rounded-box p-4 xl:p-5 2xl:p-6">
						<legend className="fieldset-legend text-base 2xl:text-lg">
							Image Formats
						</legend>

						<label className="label cursor-pointer justify-between">
							<span className="font-medium text-sm xl:text-base 2xl:text-lg">
								Select / Deselect All
							</span>
							<input
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
								<form.Field key={name} name={name}>
									{(field) => (
										<label className="label cursor-pointer justify-start gap-3">
											<input
												type="checkbox"
												className="checkbox checkbox-sm xl:checkbox-md checkbox-primary"
												checked={field.state.value}
												onChange={(e) => field.handleChange(e.target.checked)}
											/>
											<span className="text-sm xl:text-base">{label}</span>
										</label>
									)}
								</form.Field>
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
		</Modal>
	);
};

export default AdvancedFiltersModal;
