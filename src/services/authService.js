import { supabase } from '../services/supabaseClient';

export const sendPasswordResetEmail = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${import.meta.env.VITE_FRONTEND_URL}/reset-password`,
  });

  if (error) {
    console.error('Supabase password reset error:', error);
    throw new Error('اگر کاربری با این ایمیل وجود داشته باشد، لینک بازیابی ارسال خواهد شد.');
  }

  return { 
    success: true, 
    message: 'لینک بازیابی به ایمیل شما ارسال شد'
  };
};

export const resetPassword = async (newPassword) => {

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    console.error('Supabase password update error:', error);
    throw new Error('خطا در تغییر رمز عبور. ممکن است لینک منقضی شده باشد.');
  }

  return { success: true, user: data.user };
};
