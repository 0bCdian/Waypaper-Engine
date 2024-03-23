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
            setValue(
                'playlistStartOnFirstImage',
                data.playlistStartOnFirstImage
            );
            setValue('notifications', data.notifications);
            setValue('swwwAnimations', data.swwwAnimations);
            setValue('startMinimized', data.startMinimized);
            setValue('minimizeInsteadOfClose', data.minimizeInsteadOfClose);
            setValue('showMonitorModalOnStart', data.showMonitorModalOnStart);
        });
    }, []);

    return (
        <>
            <AnimatePresence>
                <motion.div
                    className="flex flex-col items-center mt-10 m-auto  cursor-default"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                >
                    <h1 className="text-7xl font-semibold py-2 self-center text-center">
                        App Settings
                    </h1>
                    <div className="divider"></div>
                    <form
                        onSubmit={e => {
                            void handleSubmit(onSubmit)(e);
                        }}
                    >
                        <div className="my-6 flex gap-3">
                            <input
                                type="checkbox"
                                id="killDaemon"
                                className="checkbox mt-4"
                                {...register('killDaemon')}
                            />
                            <label htmlFor="killDaemon" className="label">
                                <span className="label-text   text-3xl">
                                    Kill daemon on app exit
                                </span>
                            </label>
                        </div>
                        <div className="my-6 flex gap-3">
                            <input
                                type="checkbox"
                                id="playlistStart"
                                className="checkbox mt-4"
                                {...register('playlistStartOnFirstImage')}
                            />
                            <label htmlFor="playlistStart" className="label">
                                <span className="label-text text-3xl">
                                    Always start playlists on the first image
                                </span>
                            </label>
                        </div>
                        <div className="my-6 flex gap-3">
                            <input
                                type="checkbox"
                                className="checkbox mt-4"
                                id="notifications"
                                {...register('notifications')}
                            />
                            <label htmlFor="notifications" className="label">
                                <span className="label-text text-3xl">
                                    Desktop Notifications
                                </span>
                            </label>
                        </div>
                        <div className="my-6 flex gap-3">
                            <input
                                type="checkbox"
                                id="swwwAnimations"
                                className="checkbox mt-4"
                                {...register('swwwAnimations')}
                            />
                            <label htmlFor="swwwAnimations" className="label">
                                <span className="label-text text-3xl">
                                    Swww animations
                                </span>
                            </label>
                        </div>
                        <div className="my-6 flex gap-3">
                            <input
                                type="checkbox"
                                id="startMinimized"
                                className="checkbox mt-4"
                                {...register('startMinimized')}
                            />
                            <label htmlFor="startMinimized" className="label">
                                <span className="label-text text-3xl">
                                    Start the app in the tray
                                </span>
                            </label>
                        </div>
                        <div className="my-6 flex gap-3">
                            <input
                                type="checkbox"
                                id="minimizeInsteadOfClose"
                                className="checkbox mt-4"
                                {...register('minimizeInsteadOfClose')}
                            />
                            <label
                                htmlFor="minimizeInsteadOfClose"
                                className="label"
                            >
                                <span className="label-text text-3xl">
                                    Minimize app to tray instead of closing
                                </span>
                            </label>
                        </div>
                        <div className="my-6 flex gap-3">
                            <input
                                type="checkbox"
                                id="showMonitorModalOnStart"
                                className="checkbox mt-4"
                                {...register('showMonitorModalOnStart')}
                            />
                            <label
                                htmlFor="showMonitorModalOnStart"
                                className="label"
                            >
                                <span className="label-text text-3xl">
                                    Always show monitor modal on startup
                                </span>
                            </label>
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
