import { type ChangeEvent, useEffect, useState } from "react";
import useDebounce from "../hooks/useDebounce";
import { type Filters as FiltersType } from "../types/rendererTypes";
import { imagesStore } from "../stores/images";
interface PartialFilters {
    order: "asc" | "desc";
    type: "name" | "id";
    searchString: string;
}
const initialFilters: PartialFilters = {
    order: "desc",
    type: "id",
    searchString: ""
};
function Filters() {
    const { setFilters, filters } = imagesStore();
    const [partialFilters, setPartialFilters] = useState(initialFilters);
    const onTextChange = (event: ChangeEvent<HTMLInputElement>) => {
        const target = event.target;
        if (target !== null) {
            const text = target.value;
            setPartialFilters((previous: PartialFilters) => {
                return { ...previous, searchString: text };
            });
        }
    };
    useDebounce(
        () => {
            const newFilters: FiltersType = {
                ...partialFilters,
                advancedFilters: filters.advancedFilters
            };
            setFilters(newFilters);
        },
        200,
        [partialFilters]
    );
    useEffect(() => {
        const resetFilters: FiltersType = {
            ...partialFilters,
            advancedFilters: filters.advancedFilters
        };
        setFilters(resetFilters);
    }, []);
    return (
        <section className="group mb-5 flex justify-center gap-2">
            <div className="tooltip" data-tip="more filters">
                <button
                    className="btn btn-active rounded-xl uppercase"
                    onClick={() => {
                        // @ts-expect-error workaround for daisyui
                        window.AdvancedFiltersModal.showModal();
                    }}
                >
                    Filters
                </button>
            </div>
            <div className="tooltip" data-tip="Order by Name or ID">
                <label className="btn swap btn-active swap-rotate rounded-xl text-xs uppercase">
                    <input
                        type="checkbox"
                        onChange={() => {
                            setPartialFilters(previous => {
                                const newType =
                                    previous.type === "name" ? "id" : "name";
                                return { ...previous, type: newType };
                            });
                        }}
                    />
                    <div className="swap-on">Name</div>
                    <div className="swap-off">ID</div>
                </label>
            </div>
            <div className="tooltip" data-tip="Ascending or Descending">
                <label className="btn swap btn-active swap-rotate rounded-xl uppercase">
                    <input
                        type="checkbox"
                        onChange={() => {
                            setPartialFilters(previous => {
                                const newOrder =
                                    previous.order === "asc" ? "desc" : "asc";
                                return { ...previous, order: newOrder };
                            });
                        }}
                    />
                    <div className="swap-on">Asc</div>
                    <div className="swap-off">Desc</div>
                </label>
            </div>
            <input
                onChange={onTextChange}
                type="text"
                id="default-search"
                className="input input-primary w-1/6 rounded-xl border-0 bg-base-300 text-center text-xl font-medium sm:w-1/4"
                placeholder="Search"
            />
        </section>
    );
}

export default Filters;
