import { useState, useEffect, useRef, useMemo } from 'react'
import LoadPlaylistModal from './LoadPlaylistModal'
import SavePlaylistModal from './SavePlaylistModal'
import PlaylistConfigurationModal from './PlaylistConfigurationModal'
import playlistStore from '../hooks/useGlobalPlaylist'
import { PlaylistTypeDB } from '../../electron/types/types'

const { queryPlaylists } = window.API_RENDERER
function Modals() {
  const { readPlaylist } = playlistStore()
  const shouldReload = useRef(false)
  const [playlistsInDB, setPlaylistsInDB] = useState<PlaylistTypeDB[]>([])
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
