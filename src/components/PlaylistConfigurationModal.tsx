import { useForm, useStore } from "@tanstack/react-form";
import { useRef, useEffect, useState } from "react";
import { usePlaylistStore } from "../stores/playlist";
import { useShallow } from "zustand/react/shallow";
import {
  type PLAYLIST_TYPES_TYPE,
  type PLAYLIST_ORDER_TYPES,
  PLAYLIST_TYPES,
  PLAYLIST_ORDER,
} from "../../shared/types/playlist";
import { toSeconds, toHoursAndMinutes } from "../utils/utilities";
import Modal, { type ModalHandle } from "./Modal";
import { useModalStore } from "../stores/modalStore";
import { logger } from "../utils/logger";
import { useIsNeo } from "../hooks/useIsNeo";
import { cn } from "../utils/cn";

const PlaylistConfigurationModal = () => {
  const isNeo = useIsNeo();
  const [showError, setShowError] = useState(false);
  const { setConfiguration, playlist } = usePlaylistStore(
    useShallow((s) => ({
      setConfiguration: s.setConfiguration,
      playlist: s.playlist,
    })),
  );
  const containerRef = useRef<ModalHandle>(null);

  const initialHours =
    playlist.configuration.interval != null
      ? toHoursAndMinutes(playlist.configuration.interval).hours.toString()
      : "1";
  const initialMinutes =
    playlist.configuration.interval != null
      ? toHoursAndMinutes(playlist.configuration.interval).minutes.toString()
      : "0";

  const form = useForm({
    defaultValues: {
      type: playlist.configuration.type as PLAYLIST_TYPES_TYPE,
      order: (playlist.configuration.order ?? null) as PLAYLIST_ORDER_TYPES | null,
      hours: initialHours as string | null,
      minutes: initialMinutes as string | null,
      alwaysStartOnFirstImage: playlist.configuration.always_start_on_first_image,
    },
    onSubmit: ({ value }) => {
      switch (value.type) {
        case "timer":
          if (value.hours === null || value.minutes === null) {
            logger.error("Hours and minutes are required");
          } else {
            const interval = toSeconds(parseInt(value.hours, 10), parseInt(value.minutes, 10));
            setConfiguration({
              type: value.type,
              order: value.order ?? undefined,
              always_start_on_first_image: value.alwaysStartOnFirstImage,
              interval,
            });
          }
          break;
        case "time_of_day":
          setConfiguration({
            type: value.type,
            order: undefined,
            interval: undefined,
            always_start_on_first_image: false,
          });
          break;
        case "day_of_week":
          if (playlist.images.length > 7) {
            setShowError(true);
            setTimeout(() => setShowError(false), 5000);
            return;
          }
          setConfiguration({
            type: value.type,
            order: undefined,
            interval: undefined,
            always_start_on_first_image: false,
          });
          break;
        case "manual":
          setConfiguration({
            type: value.type,
            order: value.order ?? undefined,
            interval: undefined,
            always_start_on_first_image: value.alwaysStartOnFirstImage,
          });
          break;
        default:
          logger.error("Invalid playlist type");
      }
      closeModal();
    },
  });

  const playlistType = useStore(form.store, (s) => s.values.type);
  const hours = useStore(form.store, (s) => s.values.hours);
  const minutes = useStore(form.store, (s) => s.values.minutes);

  useEffect(() => {
    if (hours === null || minutes === null) return;
    const parsedHours = parseInt(hours, 10);
    const parsedMinutes = parseInt(minutes, 10);
    if (parsedMinutes === 60) {
      form.setFieldValue("hours", (parsedHours + 1).toString());
      form.setFieldValue("minutes", "0");
    }
    if (parsedMinutes === 0 && parsedHours === 0) {
      form.setFieldValue("minutes", "1");
    }
  }, [hours, minutes, form]);

  useEffect(() => {
    const interval = playlist.configuration.interval;
    if (interval != null) {
      const { hours, minutes } = toHoursAndMinutes(interval);
      form.setFieldValue("hours", hours.toString());
      form.setFieldValue("minutes", minutes.toString());
    }
    form.setFieldValue("type", playlist.configuration.type);
    form.setFieldValue("order", playlist.configuration.order ?? null);
    form.setFieldValue(
      "alwaysStartOnFirstImage",
      playlist.configuration.always_start_on_first_image,
    );
  }, [playlist, form]);

  useEffect(() => {
    if (containerRef.current) {
      useModalStore.getState().register("playlistConfigurationModal", containerRef.current);
    }
    return () => useModalStore.getState().unregister("playlistConfigurationModal");
  }, []);

  const closeModal = () => {
    containerRef.current?.close();
  };

  const classNameDisabled = playlist.images.length > 7 ? "bg-error text-error-content" : "";

  const showTimerFields = playlistType === PLAYLIST_TYPES.TIMER;
  const showOrderField =
    playlistType !== PLAYLIST_TYPES.TIME_OF_DAY && playlistType !== PLAYLIST_TYPES.DAY_OF_WEEK;

  const neoFieldset = cn(
    "fieldset bg-base-200 p-4 xl:p-5 2xl:p-6",
    isNeo
      ? "rounded-none border-4 border-base-content/20"
      : "rounded-box border border-base-300",
  );

  return (
    <Modal
      id="playlistConfigurationModal"
      ref={containerRef}
      stripedHeader={{
        title: "Playlist Settings",
        subtitle:
          "Control how wallpapers advance — timer, shuffle, and weekly layouts.",
        titleDefaultExtra: "xl:text-4xl",
      }}
      className={cn(
        "modal-box flex max-w-lg flex-col xl:max-w-xl 2xl:max-w-2xl",
        isNeo ? "max-h-[90vh] overflow-hidden p-0" : "gap-4 p-6",
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-6",
          isNeo ? "overflow-y-auto px-6 pb-8 pt-8" : "",
        )}
      >
        <div
          data-visible={showError}
          className="alert alert-error m-0 shadow-none opacity-0 transition-opacity duration-300 data-[visible=true]:opacity-100"
          style={{ display: showError ? undefined : "none" }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-left font-[family-name:var(--font-body)] text-sm font-semibold md:text-base">
            Weekly playlists cannot have more than 7 images.
          </span>
        </div>

        <form
          className={cn(
            "flex flex-col xl:gap-5 2xl:gap-6",
            !isNeo && "gap-4",
            isNeo ? "gap-6" : "",
          )}
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <fieldset className={neoFieldset}>
            <legend className="fieldset-legend text-base 2xl:text-lg">Change Wallpaper</legend>

          <form.Field name="type">
            {(field) => (
              <select
                id="type"
                className="select select-bordered w-full text-base xl:text-lg"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value as PLAYLIST_TYPES_TYPE)}
                onBlur={field.handleBlur}
              >
                <option value={PLAYLIST_TYPES.TIMER}>On a timer</option>
                <option value={PLAYLIST_TYPES.TIME_OF_DAY}>Time of day</option>
                <option
                  disabled={playlist.images.length > 7}
                  className={classNameDisabled}
                  value={PLAYLIST_TYPES.DAY_OF_WEEK}
                >
                  Day of week
                </option>
                <option value={PLAYLIST_TYPES.MANUAL}>Manual</option>
              </select>
            )}
          </form.Field>

          {showTimerFields && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="hours" className="label text-sm xl:text-base font-medium">
                  Hours
                </label>
                <form.Field name="hours">
                  {(field) => (
                    <input
                      id="hours"
                      min="0"
                      type="number"
                      value={field.state.value ?? "1"}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className="input input-bordered xl:input-lg w-full"
                    />
                  )}
                </form.Field>
              </div>
              <div>
                <label htmlFor="minutes" className="label text-sm xl:text-base font-medium">
                  Minutes
                </label>
                <form.Field name="minutes">
                  {(field) => (
                    <input
                      id="minutes"
                      min="0"
                      max="60"
                      type="number"
                      step={1}
                      value={field.state.value ?? "0"}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className="input input-bordered xl:input-lg w-full"
                    />
                  )}
                </form.Field>
              </div>
            </div>
          )}
        </fieldset>

        {showOrderField && (
          <fieldset className={neoFieldset}>
            <legend className="fieldset-legend text-base 2xl:text-lg">Order</legend>
            <form.Field name="order">
              {(field) => (
                <select
                  className="select select-bordered w-full text-base xl:text-lg"
                  value={field.state.value ?? PLAYLIST_ORDER.ordered}
                  onChange={(e) => field.handleChange(e.target.value as PLAYLIST_ORDER_TYPES)}
                  onBlur={field.handleBlur}
                  id="order"
                >
                  <option value={PLAYLIST_ORDER.random}>Random</option>
                  <option value={PLAYLIST_ORDER.ordered}>Ordered</option>
                </select>
              )}
            </form.Field>
          </fieldset>
        )}

        {showOrderField && (
          <fieldset className={neoFieldset}>
            <legend className="fieldset-legend text-base 2xl:text-lg">Options</legend>
            <form.Field name="alwaysStartOnFirstImage">
              {(field) => (
                <label
                  htmlFor="alwaysStartOnFirstImage"
                  className="label cursor-pointer justify-between"
                >
                  <span className="text-sm xl:text-base 2xl:text-lg font-medium">
                    Always start on the first image
                  </span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    id="alwaysStartOnFirstImage"
                    checked={field.state.value}
                    onChange={(e) => field.handleChange(e.target.checked)}
                  />
                </label>
              )}
            </form.Field>
          </fieldset>
        )}

        <button
          type="submit"
          className={cn("btn btn-primary btn-block xl:btn-lg", isNeo ? "mt-6" : "mt-2")}
        >
          Save
        </button>
        </form>
      </div>
    </Modal>
  );
};

export default PlaylistConfigurationModal;
