import {
    useReducer,
    useCallback,
    useMemo,
    useContext,
    createContext,
    useEffect
} from "react";
import {
    type Image,
    STORE_ACTIONS,
    type Filters,
    type state,
    type action,
    type imagesObject
} from "../types/rendererTypes";
const { queryImages } = window.API_RENDERER;
const initialFilters: Filters = {
    order: "desc",
    type: "id",
    searchString: "",
    advancedFilters: {
        formats: [
            "jpeg",
            "jpg",
            "webp",
            "gif",
            "png",
            "bmp",
            "tiff",
            "tga",
            "pnm",
            "farbeld"
        ],
        resolution: {
            constraint: "all",
            width: 0,
            height: 0
        }
    }
};
function reducer(state: state, action: action) {
    switch (action.type) {
        case STORE_ACTIONS.SET_IMAGES_ARRAY:
            return {
                ...state,
                imagesArray: [...action.payload, ...state.imagesArray]
            };
        case STORE_ACTIONS.SET_SKELETONS_TO_SHOW:
            return { ...state, skeletonsToShow: action.payload };
        case STORE_ACTIONS.SET_FILTERS:
            return { ...state, filters: action.payload };
        case STORE_ACTIONS.RESET_IMAGES_ARRAY:
            return { ...state, imagesArray: action.payload };
    }
}

function imagesSource() {
    const [{ imagesArray, skeletonsToShow, filters }, dispatch] = useReducer(
        reducer,
        {
            imagesArray: [] as Image[],
            skeletonsToShow: undefined,
            filters: initialFilters
        }
    );
    useEffect(() => {
        void queryImages().then((data: Image[]) => {
            dispatch({ type: STORE_ACTIONS.SET_IMAGES_ARRAY, payload: data });
        });
    }, []);
    const setFilters = useCallback((newFilters: Filters) => {
        dispatch({
            type: STORE_ACTIONS.SET_FILTERS,
            payload: newFilters
        });
    }, []);
    const resetImageCheckboxes = useCallback(() => {
        const resetImagesArray = imagesArray.map(image => {
            image.isChecked = false;
            return image;
        });
        dispatch({
            type: STORE_ACTIONS.RESET_IMAGES_ARRAY,
            payload: resetImagesArray
        });
    }, [imagesArray]);
    const reQueryImages = useCallback(() => {
        void queryImages().then((data: Image[]) => {
            dispatch({ type: STORE_ACTIONS.RESET_IMAGES_ARRAY, payload: data });
        });
    }, []);
    const removeImageFromStore = useCallback(
        (imageID: number) => {
            const newImagesArray = imagesArray.filter(
                image => image.id !== imageID
            );
            dispatch({
                type: STORE_ACTIONS.RESET_IMAGES_ARRAY,
                payload: newImagesArray
            });
        },
        [imagesArray]
    );
    const clearSkeletons = useCallback(() => {
        dispatch({
            type: STORE_ACTIONS.SET_SKELETONS_TO_SHOW,
            payload: undefined
        });
    }, []);
    const setSkeletons = useCallback((skeletons: imagesObject | undefined) => {
        dispatch({
            type: STORE_ACTIONS.SET_SKELETONS_TO_SHOW,
            payload: skeletons
        });
    }, []);
    const setImagesArray = useCallback((newImages: Image[]) => {
        dispatch({
            type: STORE_ACTIONS.SET_IMAGES_ARRAY,
            payload: newImages
        });
    }, []);

    const sortedImages = useMemo(() => {
        const shallowCopy = [...imagesArray];
        if (filters.order === "desc") {
            return shallowCopy.sort((a, b) =>
                a[filters.type] > b[filters.type] ? -1 : 1
            );
        } else {
            return shallowCopy.sort((a, b) =>
                a[filters.type] < b[filters.type] ? -1 : 1
            );
        }
    }, [imagesArray, filters.order, filters.type]);

    const filteredImages = useMemo(() => {
        // this is done on purpose to prevent as much iterations of sortedImages as possible
        const dontFilterByResolution =
            filters.advancedFilters.resolution.constraint === "all" ||
            filters.advancedFilters.resolution.width +
                filters.advancedFilters.resolution.height ===
                0;
        const dontFilterByFormat =
            filters.advancedFilters.formats.length === 10;
        const dontFilterByName = filters.searchString === "";
        const imagesfilteredByResolution: Image[] = dontFilterByResolution
            ? sortedImages
            : sortedImages.filter(image => {
                  const widthToFilter =
                      filters.advancedFilters.resolution.width;
                  const heightToFilter =
                      filters.advancedFilters.resolution.height;
                  switch (filters.advancedFilters.resolution.constraint) {
                      case "exact":
                          return (
                              image.width === widthToFilter &&
                              image.height === heightToFilter
                          );
                      case "lessThan":
                          return (
                              image.width < widthToFilter &&
                              image.height < heightToFilter
                          );
                      case "moreThan":
                          return (
                              image.width > widthToFilter &&
                              image.height > heightToFilter
                          );
                  }
                  return undefined;
              });
        let imagesFilteredByFormat: Image[];
        if (filters.advancedFilters.formats.length === 0) {
            imagesFilteredByFormat = [];
        } else {
            imagesFilteredByFormat = dontFilterByFormat
                ? imagesfilteredByResolution
                : imagesfilteredByResolution.filter(images =>
                      filters.advancedFilters.formats.includes(images.format)
                  );
        }
        const imagesFilteredByName: Image[] = dontFilterByName
            ? imagesFilteredByFormat
            : imagesFilteredByFormat.filter(image =>
                  image.name
                      .toLocaleLowerCase()
                      .includes(filters.searchString.toLocaleLowerCase())
              );
        return imagesFilteredByName;
    }, [filters, sortedImages]);
    const isEmpty = useMemo(
        () => !(imagesArray.length > 0 || skeletonsToShow !== undefined),
        [skeletonsToShow, imagesArray]
    );
    return {
        imagesArray,
        skeletonsToShow,
        filteredImages,
        isEmpty,
        filters,
        setFilters,
        setImagesArray,
        setSkeletons,
        resetImageCheckboxes,
        clearSkeletons,
        reQueryImages,
        removeImageFromStore
    };
}

const ImagesContext = createContext<
    ReturnType<typeof imagesSource> | undefined
>(undefined);

export function ImagesProvider({ children }: { children: React.ReactNode }) {
    return (
        <ImagesContext.Provider value={imagesSource()}>
            {children}
        </ImagesContext.Provider>
    );
}
export function useImages() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return useContext(ImagesContext)!;
}
