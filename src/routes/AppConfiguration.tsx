import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
interface AppConfig {
    killDaemon: boolean;
    playlistStartOnFirstImage: boolean;
    notifications: boolean;
    swwwAnimations: boolean;
    introAnimation: boolean;
    startMinimized: boolean;
    minimizeInsteadOfClose: boolean;
}

export interface AppConfigDB {
    killDaemon: 0 | 1;
    playlistStartOnFirstImage: 0 | 1;
    notifications: 0 | 1;
    swwwAnimations: 0 | 1;
    introAnimation: 0 | 1;
    startMinimized: 0 | 1;
    minimizeInsteadOfClose: 0 | 1;
}
const { readAppConfig, updateAppConfig } = window.API_RENDERER;
const AppConfiguration = () => {
    const { register, handleSubmit, setValue } = useForm<AppConfig>();
    const onSubmit = (data: AppConfig) => {
        const newData = {
            killDaemon: data.killDaemon ? 1 : 0,
            playlistStartOnFirstImage: data.playlistStartOnFirstImage ? 1 : 0,
            notifications: data.notifications ? 1 : 0,
            swwwAnimations: data.swwwAnimations ? 1 : 0,
            introAnimation: data.introAnimation ? 1 : 0,
            startMinimized: data.startMinimized ? 1 : 0,
            minimizeInsteadOfClose: data.minimizeInsteadOfClose ? 1 : 0
        };
        updateAppConfig(newData as AppConfigDB);
    };
    useEffect(() => {
        void readAppConfig().then((data: AppConfigDB) => {
            setValue('killDaemon', Boolean(data.killDaemon));
            setValue('playlistStartOnFirstImage', Boolean(data.playlistStartOnFirstImage));
            setValue('notifications', Boolean(data.notifications));
            setValue('swwwAnimations', Boolean(data.swwwAnimations));
            setValue('introAnimation', Boolean(data.introAnimation));
            setValue('startMinimized', Boolean(data.startMinimized));
            setValue('minimizeInsteadOfClose', Boolean(data.minimizeInsteadOfClose));
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
                    <h1 className="text-7xl font-semibold py-2 self-center text-center">App Settings</h1>
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
                                <span className="label-text   text-3xl">Kill daemon on app exit</span>
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
                                <span className="label-text text-3xl">Always start playlists on the first image</span>
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
                                <span className="label-text text-3xl">Desktop Notifications</span>
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
                                <span className="label-text text-3xl">Swww animations</span>
                            </label>
                        </div>
                        <div className="my-6 flex gap-3">
                            <input
                                type="checkbox"
                                id="introAnimation"
                                className="checkbox mt-4"
                                {...register('introAnimation')}
                            />
                            <label htmlFor="introAnimation" className="label">
                                <span className="label-text text-3xl">App intro animation</span>
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
                                <span className="label-text text-3xl">Start the app in the tray</span>
                            </label>
                        </div>
                        <div className="my-6 flex gap-3">
                            <input
                                type="checkbox"
                                id="minimizeInsteadOfClose"
                                className="checkbox mt-4"
                                {...register('minimizeInsteadOfClose')}
                            />
                            <label htmlFor="minimizeInsteadOfClose" className="label">
                                <span className="label-text text-3xl">Minimize app to tray instead of closing</span>
                            </label>
                        </div>
                        <div className="divider"></div>
                        <div className="my-6 flex justify-center gap-3">
                            <button className="btn btn-primary btn-lg rounded-md" type="submit">
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
