import { useEffect, useMemo, useState } from 'react';
import { imagesStore } from '../stores/images';
import { type rendererImage } from '../types/rendererTypes';
import { useHotkeys } from 'react-hotkeys-hook';
export function useFilteredImages() {
    // The default order is descending, the images come in sorted from the database by ID in descending order.
    // So we must respect that order in the ordering of names
    // And we "order" by ascending or descending
    const { imagesArray, filters } = imagesStore();
    const [filteredImages, setFilteredImages] =
        useState<rendererImage[]>(imagesArray);
    useHotkeys('ctrl+shift+a', () => {
        for (let index = 0; index < filteredImages.length; index++) {
            filteredImages[index].isSelected =
                !filteredImages[index].isSelected;
        }
        setFilteredImages([...filteredImages]);
    });
    useHotkeys('escape', () => {
        for (let index = 0; index < filteredImages.length; index++) {
            filteredImages[index].isSelected = false;
        }
        setFilteredImages([...filteredImages]);
    });
    const sortedImages = useMemo(() => {
        if (filters.type === 'id') return imagesArray;
        const shallowCopy = [...imagesArray];
        shallowCopy.sort((a, b) => b.name.localeCompare(a.name));
        return shallowCopy;
    }, [imagesArray, filters]);
    useEffect(() => {
        // this is done on purpose to prevent as much iterations of sortedImages as possible
        const dontFilterByResolution =
            filters.advancedFilters.resolution.constraint === 'all' ||
            filters.advancedFilters.resolution.width +
                filters.advancedFilters.resolution.height ===
                0;
        const dontFilterByFormat =
            filters.advancedFilters.formats.length === 10;
        const dontFilterByName = filters.searchString === '';
        const imagesfilteredByResolution: rendererImage[] =
            dontFilterByResolution
                ? sortedImages
                : sortedImages.filter(image => {
                      const widthToFilter =
                          filters.advancedFilters.resolution.width;
                      const heightToFilter =
                          filters.advancedFilters.resolution.height;
                      switch (filters.advancedFilters.resolution.constraint) {
                          case 'exact':
                              return (
                                  image.width === widthToFilter &&
                                  image.height === heightToFilter
                              );
                          case 'lessThan':
                              return (
                                  image.width < widthToFilter &&
                                  image.height < heightToFilter
                              );
                          case 'moreThan':
                              return (
                                  image.width > widthToFilter &&
                                  image.height > heightToFilter
                              );
                      }
                      return undefined;
                  });
        let imagesFilteredByFormat: rendererImage[];
        if (filters.advancedFilters.formats.length === 0) {
            imagesFilteredByFormat = [];
        } else {
            imagesFilteredByFormat = dontFilterByFormat
                ? imagesfilteredByResolution
                : imagesfilteredByResolution.filter(images => {
                      return filters.advancedFilters.formats.includes(
                          images.format
                      );
                  });
        }
        const imagesFilteredByName: rendererImage[] = dontFilterByName
            ? imagesFilteredByFormat
            : imagesFilteredByFormat.filter(image => {
                  return image.name
                      .toLocaleLowerCase()
                      .includes(filters.searchString.toLocaleLowerCase());
              });
        setFilteredImages(imagesFilteredByName);
    }, [sortedImages, filters]);

    return filteredImages;
}
