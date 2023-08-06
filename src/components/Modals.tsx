import { useState, useEffect, useRef, useMemo } from 'react'
import LoadPlaylistModal from './LoadPlaylistModal'
import SavePlaylistModal from './SavePlaylistModal'
import PlaylistConfigurationModal from './PlaylistConfigurationModal'
import { ImagesArray } from '../types/rendererTypes'
import { playlistStore } from '../hooks/useGlobalPlaylist'
import { PlaylistType } from '../../electron/types/types'

type Props = {
  resetRef: () => void
  imagesArrayRef: React.MutableRefObject<ImagesArray>
  modifyInputElement: (
    currentState: boolean,
    elementId?: number,
    elementName?: string
  ) => void
}
const { queryPlaylists } = window.API_RENDERER
const Modals = ({ resetRef, imagesArrayRef, modifyInputElement }: Props) => {
  const { readPlaylist } = playlistStore()
  const shouldReload = useRef(false)
  const [playlistsInDB, setPlaylistsInDB] = useState<PlaylistType[]>([])
  const currentPlaylist = useMemo(() => {
    return readPlaylist()
  }, [shouldReload.current])
  useEffect(() => {
    shouldReload.current = false
    queryPlaylists().then((playlists) => {
      setPlaylistsInDB(playlists)
    })
  }, [shouldReload.current])

  return (
    <>
      <LoadPlaylistModal
        playlistInDB={playlistsInDB}
        shouldReload={shouldReload}
        resetRef={resetRef}
        imagesArrayRef={imagesArrayRef}
        modifyInputElement={modifyInputElement}
      />
      <SavePlaylistModal
        shouldReload={shouldReload}
        currentPlaylistName={currentPlaylist.name}
      />
      <PlaylistConfigurationModal
        currentPlaylistConfiguration={currentPlaylist.configuration}
      />
    </>
  )
}

export default Modals
