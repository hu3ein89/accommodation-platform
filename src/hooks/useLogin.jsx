import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { supabase } from "../services/supabaseClient"; 

export const useLogin = () => {
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const notification = useNotification();

    const handleLogin = async (values) => {
        try {
            setIsLoading(true);

            const { data, error } = await supabase.auth.signInWithPassword({
                email: values.email,
                password: values.password,
            });

            if (error) {

                throw new Error('ایمیل یا رمز عبور اشتباه است');
            }

            if (data.user) {
                const userProfile = {
                    id: data.user.id,
                    email: data.user.email,
                    ...data.user.user_metadata 
                };

                
                notification.success({
                    message: 'ورود با موفقیت انجام شد',
                    description: `${userProfile.firstName} ${userProfile.lastName} عزیز خوش آمدید` 
                });

                // هدایت کاربر بر اساس نقش
                const dashboardPath = userProfile.role === 'Guest' ? '/user-dashboard' : '/admin-dashboard';
                navigate(dashboardPath);
                
                return { success: true, user: userProfile };
            }

        } catch (error) {
            console.error('Login error:', error);
            notification.error({
                message: 'خطا در عملیات ورود',
                description: error.message || 'ایمیل یا رمز عبور اشتباه است'
            });
            return { success: false };
        } finally {
            setIsLoading(false);
        }
    };
    
    return { handleLogin, isLoading };
};