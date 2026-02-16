import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { UnifiedConfig } from "../../shared/types/unifiedConfig";

interface AppConfigForm {
	kill_daemon_on_exit: boolean;
	notifications: boolean;
	start_minimized: boolean;
	minimize_instead_of_close: boolean;
	show_monitor_modal_on_start: boolean;
	images_per_page: number;
}

const { goDaemon } = window.API_RENDERER;
const AppConfiguration = () => {
	const { register, handleSubmit, setValue } = useForm<AppConfigForm>();
	const onSubmit = async (data: AppConfigForm) => {
		await goDaemon.updateConfigSection("app", data as unknown as Record<string, unknown>);
	};
	useEffect(() => {
		void goDaemon.getConfig().then((config: UnifiedConfig) => {
			setValue("kill_daemon_on_exit", config.app.kill_daemon_on_exit);
			setValue("notifications", config.app.notifications);
			setValue("start_minimized", config.app.start_minimized);
			setValue("minimize_instead_of_close", config.app.minimize_instead_of_close);
			setValue("show_monitor_modal_on_start", config.app.show_monitor_modal_on_start);
			setValue("images_per_page", config.app.images_per_page);
		});
	}, [setValue]);

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
						onSubmit={(e) => {
							void handleSubmit(onSubmit)(e);
						}}
					>
						<div className="max-h-[65dvh] min-h-0 overflow-y-scroll scrollbar-thin scrollbar-track-transparent scrollbar-thumb-base-300 scrollbar-thumb-rounded-sm">
							<div className="bg-base-200 mx-10 my-6 flex justify-between gap-3">
								<label htmlFor="killDaemon" className="label">
									<span className="label-text text-3xl">
										Kill daemon on app exit
									</span>
								</label>
								<input
									type="checkbox"
									id="killDaemon"
									className="checkbox mt-4"
									{...register("kill_daemon_on_exit")}
								/>
							</div>
							<div className="mx-10 my-6 flex justify-between">
								<label htmlFor="notifications" className="label">
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
								<label htmlFor="startMinimized" className="label">
									<span className="label-text text-3xl">
										Start the app in the tray
									</span>
								</label>
								<input
									type="checkbox"
									id="startMinimized"
									className="checkbox mt-4"
									{...register("start_minimized")}
								/>
							</div>
							<div className="mx-10 my-6 flex justify-between">
								<label htmlFor="minimizeInsteadOfClose" className="label">
									<span className="label-text text-3xl">
										Minimize app to tray instead of closing
									</span>
								</label>
								<input
									type="checkbox"
									id="minimizeInsteadOfClose"
									className="checkbox mt-4"
									{...register("minimize_instead_of_close")}
								/>
							</div>
							<div className="mx-10 my-6 flex justify-between">
								<label htmlFor="showMonitorModalOnStart" className="label">
									<span className="label-text text-3xl">
										Always show monitor modal on startup
									</span>
								</label>
								<input
									type="checkbox"
									id="showMonitorModalOnStart"
									className="checkbox mt-4"
									{...register("show_monitor_modal_on_start")}
								/>
							</div>
							<div className="mx-10 my-6 flex items-end justify-between">
								<label htmlFor="imagesPerPage" className="label">
									<span className="label-text text-3xl">Images Per Page</span>
								</label>
								<select
									id="imagesPerPage"
									className="select select-bordered rounded-md text-2xl shadow-inner"
									{...register("images_per_page", {
										valueAsNumber: true,
									})}
								>
									<option value="20">20</option>
									<option value="50">50</option>
									<option value="100">100</option>
									<option value="200">200</option>
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
