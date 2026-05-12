import { useImagesStore } from "../stores/images";
import { useShallow } from "zustand/react/shallow";
import { useEffect, useRef } from "react";
import { useForm } from "@tanstack/react-form";
import { parseResolution } from "../utils/utilities";
import type { advancedFilters, resolutionConstraints } from "../types/rendererTypes";
import Modal, { type ModalHandle } from "./Modal";
import { useModalStore } from "../stores/modalStore";
import { cn } from "../utils/cn";

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
      resolutionConstraint: filters.advancedFilters.resolution.constraint,
      width: String(filters.advancedFilters.resolution.width),
      height: String(filters.advancedFilters.resolution.height),
    },
    onSubmit: ({ value }) => {
      const { width, height, resolutionConstraint } = value;
      const { width: parsedWidth, height: parsedHeight } = parseResolution(`${width}x${height}`);
      const nextAdvanced: advancedFilters = {
        resolution: {
          width: parsedWidth,
          height: parsedHeight,
          constraint: resolutionConstraint,
        },
      };
      setFilters({ ...filters, advancedFilters: nextAdvanced });
    },
  });

  useEffect(() => {
    form.reset({
      resolutionConstraint: filters.advancedFilters.resolution.constraint,
      width: String(filters.advancedFilters.resolution.width),
      height: String(filters.advancedFilters.resolution.height),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync modal fields when store resolution changes
  }, [
    filters.advancedFilters.resolution.constraint,
    filters.advancedFilters.resolution.width,
    filters.advancedFilters.resolution.height,
  ]);

  const neoFieldset = cn(
    "fieldset bg-base-200 p-4 xl:p-5 2xl:p-6",
    "rounded-[var(--wp-radius-md)] border-[length:var(--wp-border-w)] border-[var(--wp-border-color)]",
  );

  const innerForm = (
    <form
      method="dialog"
      className="flex flex-col gap-4 xl:gap-5 2xl:gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <fieldset className={neoFieldset}>
        <legend className="fieldset-legend text-base 2xl:text-lg">Resolution</legend>

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
                  <span className="text-sm xl:text-base 2xl:text-lg">{label}</span>
                  <input
                    type="radio"
                    value={val}
                    checked={field.state.value === val}
                    onChange={() => field.handleChange(val as resolutionConstraints)}
                    className="radio radio-primary"
                  />
                </label>
              ))}
            </>
          )}
        </form.Field>

        <p className="label mt-2 text-xs text-base-content/60 italic xl:text-sm">
          A value of zero means all resolutions
        </p>

        <div className="mt-1 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="width" className="label text-sm font-medium xl:text-base">
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
                  className="input input-bordered w-full xl:input-lg"
                />
              )}
            </form.Field>
          </div>
          <div>
            <label htmlFor="height" className="label text-sm font-medium xl:text-base">
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
                  className="input input-bordered w-full xl:input-lg"
                />
              )}
            </form.Field>
          </div>
        </div>
      </fieldset>

      <p className="text-sm text-base-content/70">
        Use the gallery token bar for tags, media type, file extension, exact color, near color
        (CIE76), and text search (<code className="text-xs">tag:</code>,{" "}
        <code className="text-xs">type:</code>, <code className="text-xs">ext:</code>,{" "}
        <code className="text-xs">color:</code>, <code className="text-xs">near:</code>,{" "}
        <code className="text-xs">q:</code>
        ). Open the <strong>?</strong> button next to the bar for a full cheatsheet.
      </p>

      <button type="submit" className="btn btn-primary btn-block mt-2 xl:btn-lg">
        Save Filters
      </button>
    </form>
  );

  return (
    <Modal
      id="AdvancedFiltersModal"
      ref={containerRef}
      stripedHeader={{
        title: "Advanced Filters",
        subtitle:
          "Constrain resolutions here; combine with tokens in the gallery bar for tags, extensions, colours, and text search.",
        bleedInsetDefault: false,
      }}
      className="modal-box flex max-w-lg flex-col xl:max-w-xl 2xl:max-w-2xl max-h-[90vh] overflow-hidden p-0"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-8 pt-8">
        {innerForm}
      </div>
    </Modal>
  );
};

export default AdvancedFiltersModal;
