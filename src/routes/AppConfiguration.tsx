import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    type appConfigSelectType,
    type appConfigInsertType
} from '../../electron/database/schema';

const { readAppConfig, updateAppConfig } = window.API_RENDERER;
const AppConfiguration = () => {
    const { register, handleSubmit, setValue } =
        useForm<appConfigInsertType['config']>();
    const onSubmit = (data: appConfigSelectType['config']) => {
        updateAppConfig(data);
    };
    useEffect(() => {
        void readAppConfig().then((data: appConfigSelectType['config']) => {
            setValue('killDaemon', data.killDaemon);
            setValue('notifications', data.notifications);
            setValue('startMinimized', data.startMinimized);
            setValue('minimizeInsteadOfClose', data.minimizeInsteadOfClose);
            setValue('showMonitorModalOnStart', data.showMonitorModalOnStart);
            setValue('imagesPerPage', data.imagesPerPage);
            setValue('randomImageMonitor', data.randomImageMonitor);
        });
    }, []);

    return (
        <>
            <AnimatePresence>
                <motion.div
                    className="flex flex-col items-center m-auto  cursor-default"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="text-7xl font-semibold py-2 self-center text-center">
                        App Settings
                    </h1>
                    <div className="divider"></div>
                    <form
                        className="w-1/2"
                        onSubmit={e => {
                            void handleSubmit(onSubmit)(e);
                        }}
                    >
                        <div className="overflow-y-scroll max-h-[65dvh] min-h-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-300 scrollbar-thumb-rounded-sm">
                            <div className="my-6 mx-10 flex gap-3 justify-between bg-red">
                                <label htmlFor="killDaemon" className="label">
                                    <span className="label-text   text-3xl">
                                        Kill daemon on app exit
                                    </span>
                                </label>
                                <input
                                    type="checkbox"
                                    id="killDaemon"
                                    className="checkbox mt-4"
                                    {...register('killDaemon')}
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
                                    {...register('notifications')}
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
                                    {...register('startMinimized')}
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
                                    {...register('minimizeInsteadOfClose')}
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
                                    {...register('showMonitorModalOnStart')}
                                />
                            </div>
                            <div className="mx-10 my-6 flex items-end justify-between ">
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
                                    className=" select select-bordered shadow-inner  rounded-md text-2xl"
                                    {...register('imagesPerPage', {
                                        valueAsNumber: true
                                    })}
                                >
                                    <option value="20">20</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                    <option value="200">200</option>
                                </select>
                            </div>{' '}
                            <div className="mx-10 my-6 flex items-end justify-between ">
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
                                    className=" select select-bordered shadow-inner rounded-md text-2xl"
                                    {...register('randomImageMonitor')}
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
