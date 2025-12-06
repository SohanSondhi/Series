import { Routes, Route } from 'react-router-dom'
import UserList from './components/UserList'
import ProfilePage from './components/ProfilePage'
import CreatePage from './components/CreatePage'
import EditProfilePage from './components/EditProfilePage'
import MessagesPage from './components/MessagesPage'
import WrappedPage from './components/WrappedPage'

function App() {
    return (
        <Routes>
            <Route path="/" element={<UserList />} />
            <Route path="/create" element={<CreatePage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/profile/:phoneNumber" element={<ProfilePage />} />
            <Route path="/profile/:phoneNumber/edit" element={<EditProfilePage />} />
            <Route path="/wrapped/:phoneNumber" element={<WrappedPage />} />
        </Routes>
    )
}

export default App

