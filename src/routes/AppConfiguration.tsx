import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    type appConfigSelectType,
    type appConfigInsertType
} from "../../database/schema";

const { readAppConfig, updateAppConfig } = window.API_RENDERER;
const AppConfiguration = () => {
    const { register, handleSubmit, setValue } =
        useForm<appConfigInsertType["config"]>();
    const onSubmit = (data: appConfigSelectType["config"]) => {
        updateAppConfig(data);
    };
    useEffect(() => {
        void readAppConfig().then((data: appConfigSelectType["config"]) => {
            setValue("killDaemon", data.killDaemon);
            setValue("notifications", data.notifications);
            setValue("startMinimized", data.startMinimized);
            setValue("minimizeInsteadOfClose", data.minimizeInsteadOfClose);
            setValue("showMonitorModalOnStart", data.showMonitorModalOnStart);
            setValue("imagesPerPage", data.imagesPerPage);
            setValue("randomImageMonitor", data.randomImageMonitor);
        });
    }, []);

    return (
        <>
            <AnimatePresence>
                <motion.div
                    className="m-auto flex cursor-default flex-col items-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="self-center py-2 text-center text-7xl font-semibold">
                        App Settings
                    </h1>
                    <div className="divider"></div>
                    <form
                        className="w-1/2"
                        onSubmit={e => {
                            void handleSubmit(onSubmit)(e);
                        }}
                    >
                        <div className="max-h-[65dvh] min-h-0 overflow-y-scroll scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-300 scrollbar-thumb-rounded-sm">
                            <div className="bg-red mx-10 my-6 flex justify-between gap-3">
                                <label htmlFor="killDaemon" className="label">
                                    <span className="label-text text-3xl">
                                        Kill daemon on app exit
                                    </span>
                                </label>
                                <input
                                    type="checkbox"
                                    id="killDaemon"
                                    className="checkbox mt-4"
                                    {...register("killDaemon")}
                                />
                            </div>
                            <div className="mx-10 my-6 flex justify-between">
                                <label
                                    htmlFor="notifications"
                                    className="label"
                                >
                                    <span className="label-text text-3xl">
                                        Desktop Notifications
                                    </span>
                                </label>
                                <input
                                    type="checkbox"
                                    className="checkbox mt-4"
                                    id="notifications"
                                    {...register("notifications")}
                                />
                            </div>
                            <div className="mx-10 my-6 flex justify-between">
                                <label
                                    htmlFor="startMinimized"
                                    className="label"
                                >
                                    <span className="label-text text-3xl">
                                        Start the app in the tray
                                    </span>
                                </label>
                                <input
                                    type="checkbox"
                                    id="startMinimized"
                                    className="checkbox mt-4"
                                    {...register("startMinimized")}
                                />
                            </div>
                            <div className="mx-10 my-6 flex justify-between">
                                <label
                                    htmlFor="minimizeInsteadOfClose"
                                    className="label"
                                >
                                    <span className="label-text text-3xl">
                                        Minimize app to tray instead of closing
                                    </span>
                                </label>
                                <input
                                    type="checkbox"
                                    id="minimizeInsteadOfClose"
                                    className="checkbox mt-4"
                                    {...register("minimizeInsteadOfClose")}
                                />
                            </div>
                            <div className="mx-10 my-6 flex justify-between">
                                <label
                                    htmlFor="showMonitorModalOnStart"
                                    className="label"
                                >
                                    <span className="label-text text-3xl">
                                        Always show monitor modal on startup
                                    </span>
                                </label>
                                <input
                                    type="checkbox"
                                    id="showMonitorModalOnStart"
                                    className="checkbox mt-4"
                                    {...register("showMonitorModalOnStart")}
                                />
                            </div>
                            <div className="mx-10 my-6 flex items-end justify-between">
                                <label
                                    htmlFor="imagesPerPage"
                                    className="label"
                                >
                                    <span className="label-text text-3xl">
                                        Images Per Page
                                    </span>
                                </label>
                                <select
                                    id="imagesPerPage"
                                    className="select select-bordered rounded-md text-2xl shadow-inner"
                                    {...register("imagesPerPage", {
                                        valueAsNumber: true
                                    })}
                                >
                                    <option value="20">20</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                    <option value="200">200</option>
                                </select>
                            </div>{" "}
                            <div className="mx-10 my-6 flex items-end justify-between">
                                <label
                                    htmlFor="randomImageMonitor"
                                    className="label"
                                >
                                    <span className="label-text text-3xl">
                                        Random image monitor behavior
                                    </span>
                                </label>
                                <select
                                    id="randomImageMonitor"
                                    className="select select-bordered rounded-md text-2xl shadow-inner"
                                    {...register("randomImageMonitor")}
                                >
                                    <option value="clone">clone</option>
                                    <option value="individual">
                                        individual
                                    </option>
                                    <option value="extend">extend</option>
                                </select>
                            </div>
                        </div>
                        <div className="divider"></div>
                        <div className="my-6 flex justify-center gap-3">
                            <button
                                className="btn btn-primary btn-lg rounded-md"
                                type="submit"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                </motion.div>
            </AnimatePresence>
        </>
    );
};
export default AppConfiguration;
