import { useState, useEffect, useRef, useMemo } from 'react'
import LoadPlaylistModal from './LoadPlaylistModal'
import SavePlaylistModal from './SavePlaylistModal'
import PlaylistConfigurationModal from './PlaylistConfigurationModal'
import playlistStore from '../hooks/playlistStore'
import { Playlist } from '../../electron/types/types'
import { useImages } from '../hooks/imagesStore'
import AdvancedFiltersModal from './AdvancedFiltersModal'

const { queryPlaylists } = window.API_RENDERER
function Modals() {
  const [playlistsInDB, setPlaylistsInDB] = useState<Playlist[]>([])
  const [shouldReload, setShouldReload] = useState<Boolean>(false)
  const { readPlaylist, isEmpty } = playlistStore()
  const { imagesArray } = useImages()
  const currentPlaylist = useMemo(() => {
    return readPlaylist()
  }, [shouldReload, isEmpty])
  useEffect(() => {
    setShouldReload(false)
    queryPlaylists().then((playlists) => {
      setPlaylistsInDB(playlists)
    })
  }, [shouldReload, imagesArray])
  useEffect(() => {
    queryPlaylists().then((newPlaylists) => {
      setPlaylistsInDB(newPlaylists)
    })
  }, [])
  return (
    <>
      <LoadPlaylistModal
        playlistsInDB={playlistsInDB}
        setShouldReload={setShouldReload}
        currentPlaylistName={currentPlaylist.name}
      />
      <SavePlaylistModal
        setShouldReload={setShouldReload}
        currentPlaylistName={currentPlaylist.name}
      />
      <PlaylistConfigurationModal />
      <AdvancedFiltersModal />
    </>
  )
}

export default Modals
