import { Routes, Route } from 'react-router-dom'
import UserList from './components/UserList'
import ProfilePage from './components/ProfilePage'
import CreatePage from './components/CreatePage'
import EditProfilePage from './components/EditProfilePage'

function App() {
    return (
        <Routes>
            <Route path="/" element={<UserList />} />
            <Route path="/create" element={<CreatePage />} />
            <Route path="/profile/:phoneNumber" element={<ProfilePage />} />
            <Route path="/profile/:phoneNumber/edit" element={<EditProfilePage />} />
        </Routes>
    )
}

export default App

