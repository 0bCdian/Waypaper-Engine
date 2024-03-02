import { type ChangeEvent, useEffect, useState } from "react";
import useDebounce from "../hooks/useDebounce";
import { useImages } from "../hooks/imagesStore";
import { type Filters as FiltersType } from "../types/rendererTypes";

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
    const { setFilters, filters } = useImages();
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
        500,
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
        <section className="flex w-full gap-2 group justify-center mb-5 ">
            <div className="flex w-full justify-center gap-2">
                <div className="tooltip" data-tip="More filters">
                    <button
                        className="btn btn-active uppercase rounded-xl text-md"
                        onClick={() => {
                            // @ts-expect-error workaround for daisyui
                            window.AdvancedFiltersModal.showModal();
                        }}
                    >
                        Filters
                    </button>
                </div>
                <div className="divider divider-horizontal mx-0" />
                <div className="tooltip" data-tip="Order by">
                    <select
                        name="orderBy"
                        id="orderBy"
                        className="select uppercase btn-active rounded-xl font-bold"
                        defaultValue={"id"}
                        onChange={e => {
                            const newType = e.currentTarget.value as
                                | "name"
                                | "id";
                            if (newType.length > 0) {
                                setPartialFilters(previous => {
                                    return { ...previous, type: newType };
                                });
                            }
                        }}
                    >
                        <option value="name">Name</option>
                        <option value="id">Date</option>
                    </select>
                </div>
                <div className="tooltip" data-tip="Ascending or Descending">
                    <label className="swap swap-rotate btn btn-active uppercase rounded-xl">
                        <input
                            type="checkbox"
                            onChange={() => {
                                setPartialFilters(previous => {
                                    const newOrder =
                                        previous.order === "asc"
                                            ? "desc"
                                            : "asc";
                                    return { ...previous, order: newOrder };
                                });
                            }}
                        />
                        <div className="swap-on">Asc</div>
                        <div className="swap-off">Desc</div>
                    </label>
                </div>
                <div className="divider divider-horizontal mx-0"></div>
                <input
                    onChange={onTextChange}
                    type="text"
                    id="default-search"
                    className="input w-[20%] input-primary bg-base-300 border-0 rounded-xl text-xl font-medium"
                    placeholder="Search by name"
                />
            </div>
        </section>
    );
}

export default Filters;
