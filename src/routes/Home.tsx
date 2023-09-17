import Gallery from '../components/Gallery'
import Modals from '../components/Modals'
import NavBar from '../components/NavBar'

const Home = () => {
  return (
    <>
      <NavBar currentRoute='/' />
      <Gallery />
      <Modals />
    </>
  )
}

export default Home
