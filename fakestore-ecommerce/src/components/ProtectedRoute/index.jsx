const ProtectedRoute = ({ children }) => {
  // Simple cookie check (no library needed!)
  const getCookie = (name) => {
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop().split(';').shift()
    return null
  }

  const token = getCookie('jwt_token')
  
  if (!token) {
    // Simple redirect
    window.location.href = '/login'
    return null
  }
  
  return children
}

export default ProtectedRoute