import React, { useState } from 'react';
import { Form, Input, Button, Card, Layout, Row, Col, Alert, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { resetPassword } from '../../services/authService'; 
import Navbar from '../Layout/Navbar';
import '../../styles/Auth.css';
import { validatePasswordStrength } from '../../utils/authHelper';

const { Content } = Layout;
const { Title } = Typography;


const ResetPassword = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if passwords match
      if (values.password !== values.confirmPassword) {
        setError('رمزهای عبور وارد شده مطابقت ندارند');
        return;
      }
      
      // Check password strength
      const strength = validatePasswordStrength(values.password);
      if (!strength.isValid) {
        setError('رمز عبور باید حداقل ۸ کاراکتر و شامل حروف بزرگ، کوچک، اعداد و کاراکترهای ویژه باشد');
        return;
      }
      
      // تابع جدید resetPassword دیگر نیازی به توکن ندارد
      await resetPassword(values.password);
      setSuccess(true);

      setTimeout(() => {
        navigate('/login', {
          state: { message: 'رمز عبور شما با موفقیت تغییر یافت', type: 'success' }
        });
      }, 3000);
    } catch (err) {
      console.error('Password reset error:', err);
      setError(err.message || 'خطا در تغییر رمز عبور');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout className="layout">
      <Navbar />
      <Content>
        <div className="auth-page">
          <Row justify="center" align="middle" className="auth-container">
            <Col xs={22} sm={16} md={12} lg={8}>
              <Card bordered={false} className="auth-card">
                <Title level={2} className="auth-title">تغییر رمز عبور</Title>
                {success ? (
                  <Alert
                    message="رمز عبور با موفقیت تغییر کرد"
                    description="در حال انتقال به صفحه ورود..."
                    type="success"
                    showIcon
                  />
                ) : (
                  <>
                    {error && (
                      <Alert
                        message={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: 24 }}
                      />
                    )}
                    <Form name="reset_password" onFinish={onFinish} layout="vertical">
                      <Form.Item 
                        name="password"
                        rules={[{ required: true, message: 'لطفاً رمز عبور جدید را وارد کنید' }]}
                      >
                        <Input.Password 
                          prefix={<LockOutlined />} 
                          placeholder="رمز عبور جدید" 
                          size="large" 
                        />
                      </Form.Item>
                      <Form.Item 
                        name="confirmPassword"
                        rules={[{ required: true, message: 'لطفاً تکرار رمز عبور را وارد کنید' }]}
                      >
                        <Input.Password 
                          prefix={<LockOutlined />} 
                          placeholder="تکرار رمز عبور جدید" 
                          size="large" 
                        />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} block size="large">
                          تغییر رمز عبور
                        </Button>
                      </Form.Item>
                    </Form>
                  </>
                )}
              </Card>
            </Col>
          </Row>
        </div>
      </Content>
    </Layout>
  );
};

export default ResetPassword;