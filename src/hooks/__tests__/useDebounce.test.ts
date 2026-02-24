import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import useDebounce from "../useDebounce";

describe("useDebounce", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("calls callback after delay", () => {
		const callback = vi.fn();
		renderHook(() => useDebounce(callback, 300, []));

		expect(callback).not.toHaveBeenCalled();
		vi.advanceTimersByTime(300);
		expect(callback).toHaveBeenCalledOnce();
	});

	it("does not call callback before delay elapses", () => {
		const callback = vi.fn();
		renderHook(() => useDebounce(callback, 500, []));

		vi.advanceTimersByTime(499);
		expect(callback).not.toHaveBeenCalled();
	});

	it("resets timer on dependency change", () => {
		const callback = vi.fn();
		let dep = 0;

		const { rerender } = renderHook(() =>
			useDebounce(callback, 300, [dep]),
		);

		vi.advanceTimersByTime(200);
		expect(callback).not.toHaveBeenCalled();

		dep = 1;
		rerender();

		vi.advanceTimersByTime(200);
		expect(callback).not.toHaveBeenCalled();

		vi.advanceTimersByTime(100);
		expect(callback).toHaveBeenCalledOnce();
	});

	it("uses the latest callback reference", () => {
		const first = vi.fn();
		const second = vi.fn();

		const { rerender } = renderHook(
			({ cb }) => useDebounce(cb, 300, []),
			{ initialProps: { cb: first } },
		);

		rerender({ cb: second });
		vi.advanceTimersByTime(300);

		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledOnce();
	});

	it("clears timeout on unmount", () => {
		const callback = vi.fn();
		const { unmount } = renderHook(() => useDebounce(callback, 300, []));

		vi.advanceTimersByTime(100);
		unmount();
		vi.advanceTimersByTime(300);

		expect(callback).not.toHaveBeenCalled();
	});
});
