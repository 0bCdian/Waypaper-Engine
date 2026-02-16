// App config type matching daemon API contract AppConfig
export interface appConfigType {
	kill_daemon_on_exit: boolean;
	notifications: boolean;
	start_minimized: boolean;
	minimize_instead_of_close: boolean;
	show_monitor_modal_on_start: boolean;
	images_per_page: number;
	theme: "light" | "dark" | "system";
	image_history_limit: number;
	sort_by: "name" | "imported_at" | "file_size";
	sort_order: "asc" | "desc";
}
