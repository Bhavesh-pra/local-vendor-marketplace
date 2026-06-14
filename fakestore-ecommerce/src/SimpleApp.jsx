import { Routes, Route } from 'react-router-dom'
import Home from './components/Home'
import SimpleLogin from './components/SimpleLogin'
import SimpleProtectedRoute from './components/SimpleProtectedRoute'

const SimpleApp = () => (
  <Routes>
    <Route path="/login" element={<SimpleLogin />} />
    <Route path="/" element={<SimpleProtectedRoute><Home /></SimpleProtectedRoute>} />
  </Routes>
)

export default SimpleApp
