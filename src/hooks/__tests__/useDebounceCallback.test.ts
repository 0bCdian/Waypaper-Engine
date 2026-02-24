import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useDebounceCallback from "../useDebounceCallback";

describe("useDebounceCallback", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("calls callback after delay with arguments", () => {
		const callback = vi.fn();
		const { result } = renderHook(() => useDebounceCallback(callback, 300));

		act(() => {
			result.current("a", 42);
		});

		expect(callback).not.toHaveBeenCalled();
		vi.advanceTimersByTime(300);
		expect(callback).toHaveBeenCalledOnce();
		expect(callback).toHaveBeenCalledWith("a", 42);
	});

	it("resets timer on subsequent calls", () => {
		const callback = vi.fn();
		const { result } = renderHook(() => useDebounceCallback(callback, 300));

		act(() => {
			result.current("first");
		});

		vi.advanceTimersByTime(200);

		act(() => {
			result.current("second");
		});

		vi.advanceTimersByTime(200);
		expect(callback).not.toHaveBeenCalled();

		vi.advanceTimersByTime(100);
		expect(callback).toHaveBeenCalledOnce();
		expect(callback).toHaveBeenCalledWith("second");
	});

	it("uses the latest callback reference", () => {
		const first = vi.fn();
		const second = vi.fn();

		const { result, rerender } = renderHook(
			({ cb }) => useDebounceCallback(cb, 300),
			{ initialProps: { cb: first } },
		);

		rerender({ cb: second });

		act(() => {
			result.current("test");
		});

		vi.advanceTimersByTime(300);

		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledOnce();
		expect(second).toHaveBeenCalledWith("test");
	});

	it("cleans up pending timeout on unmount", () => {
		const callback = vi.fn();
		const { result, unmount } = renderHook(() =>
			useDebounceCallback(callback, 300),
		);

		act(() => {
			result.current("val");
		});

		unmount();
		vi.advanceTimersByTime(300);

		expect(callback).not.toHaveBeenCalled();
	});
});
