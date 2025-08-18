import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { App as AntApp } from 'antd';
import { NotificationContext } from './context/NotificationContext';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Unauthorized from './components/Unauthorized';
import AdminDashboard from './components/Dashboard/AdminDashboard';
import UserDashboard from './components/Dashboard/UserDashboard';
import HotelDetails from './components/HotelDetails';
import HotelListPage from './pages/HotelListPage';
import HomePage from './components/HomePage';
import AboutUsPage from './pages/AboutUsPage';
import ContactUsPage from './pages/ContactUsPage';
import PaymentPage from './pages/PaymentPage';
import ForgotPassword from './components/Auth/ForgetPassword';
import ResetPassword from './components/Auth/ResetPassword';
import ProtectedRoute from './components/ProtectedRoute';

const App = () => {
  const { notification } = AntApp.useApp();

  useEffect(() => {
    const handleRouteError = (error) => {
      if (error.message.includes('Failed to load resource')) {
        window.location.reload();
      }
    };
    window.addEventListener('error', handleRouteError);
    return () => window.removeEventListener('error', handleRouteError);
  }, []);


  return (
    <NotificationContext.Provider value={notification}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/hotels" element={<HotelListPage />} />
        <Route path="/hotels/:id" element={<HotelDetails />} />
        <Route path="/about" element={<AboutUsPage />} />
        <Route path="/contact" element={<ContactUsPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected Routes */}
        <Route
          path="/user-dashboard/*"
          element={
            <ProtectedRoute roles={["Guest"]}>
              <UserDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment"
          element={
            <ProtectedRoute roles={["Guest", "Admin", "Hotel Manager"]}>
              <PaymentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/*"
          element={
            <ProtectedRoute roles={["Admin", "Hotel Manager"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        {/* 404 Route */}
        <Route path="*" element={<Unauthorized />} />
      </Routes>
    </NotificationContext.Provider>
  );
};

export default App;