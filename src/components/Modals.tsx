import { useState, useEffect, useRef, useMemo } from 'react'
import LoadPlaylistModal from './LoadPlaylistModal'
import SavePlaylistModal from './SavePlaylistModal'
import PlaylistConfigurationModal from './PlaylistConfigurationModal'
import playlistStore from '../hooks/playlistStore'
import { Playlist } from '../../electron/types/types'
import { useImages } from '../hooks/imagesStore'

const { queryPlaylists } = window.API_RENDERER
function Modals() {
  const { readPlaylist } = playlistStore()
  const { imagesArray } = useImages()
  const shouldReload = useRef(false)
  const [playlistsInDB, setPlaylistsInDB] = useState<Playlist[]>([])
  const currentPlaylist = useMemo(() => {
    return readPlaylist()
  }, [shouldReload.current])
  useEffect(() => {
    shouldReload.current = false
    queryPlaylists().then((playlists) => {
      setPlaylistsInDB(playlists)
    })
  }, [shouldReload.current, imagesArray])

  return (
    <>
      <LoadPlaylistModal
        playlistInDB={playlistsInDB}
        shouldReload={shouldReload}
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
