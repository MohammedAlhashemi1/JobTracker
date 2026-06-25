import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Landing from './pages/Landing';
import Generate from './pages/Generate';
import GeneratePage from './pages/GeneratePage';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import Chat from './pages/Chat';
import Profile from './pages/Profile';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* public */}
          <Route path="/"        element={<Landing />} />
          <Route path="/login"   element={<Login />}   />
          <Route path="/register" element={<Register />} />

          {/* protected */}
          <Route path="/generate"         element={<PrivateRoute><GeneratePage /></PrivateRoute>} />
          <Route path="/generate/results" element={<PrivateRoute><Generate     /></PrivateRoute>} />
          <Route path="/dashboard"        element={<PrivateRoute><Dashboard    /></PrivateRoute>} />
          <Route path="/applications"     element={<PrivateRoute><Applications /></PrivateRoute>} />
          <Route path="/chat"             element={<PrivateRoute><Chat         /></PrivateRoute>} />
          <Route path="/profile"          element={<PrivateRoute><Profile      /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
