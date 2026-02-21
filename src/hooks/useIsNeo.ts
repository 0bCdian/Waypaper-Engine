import { useDesignSystemStore } from "../stores/designSystemStore";

export const useIsNeo = () =>
	useDesignSystemStore((s) => s.designMode === "neobrutalist");
