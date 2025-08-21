import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Layout, Row, Col, Alert, Typography, Progress, Space } from 'antd';
import { LockOutlined, EyeInvisibleOutlined, EyeTwoTone, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../../services/authService'; 
import Navbar from '../Layout/Navbar';
import '../../styles/Auth.css';
import { validatePasswordStrength } from '../../utils/authHelper';

const { Content } = Layout;
const { Title, Text } = Typography;

const ResetPassword = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState(null);
  const [passwordStrength, setPasswordStrength] = useState({ isValid: false, requirements: null });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  useEffect(() => {
    const resetToken = searchParams.get('token');
    if (!resetToken) {
      setError('لینک بازنشانی رمز عبور نامعتبر است');
    }
    setToken(resetToken);
  }, [searchParams]);

  const handlePasswordChange = (e) => {
    const password = e.target.value;
    setPasswordStrength(validatePasswordStrength(password));
  };

  const calculatePasswordStrengthScore = (password) => {
    if (!password) return 0;
    
    const { requirements } = validatePasswordStrength(password);
    let score = 0;
    
    if (password.length >= requirements.minLength) score += 25;
    if (requirements.hasUpperCase) score += 25;
    if (requirements.hasLowerCase) score += 25;
    if (requirements.hasNumber) score += 15;
    if (requirements.hasSpecialChar) score += 10;
    
    return Math.min(score, 100);
  };

  const getPasswordStrengthColor = (score) => {
    if (score < 40) return '#ff4d4f';
    if (score < 70) return '#faad14';
    return '#52c41a';
  };

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
        setError('لطفاً یک رمز عبور قوی‌تر انتخاب کنید');
        return;
      }
      
      await resetPassword(token, values.password);
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

  const RequirementItem = ({ met, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4, fontSize: '12px' }}>
      {met ? (
        <CheckOutlined style={{ color: '#52c41a', marginLeft: 4 }} />
      ) : (
        <CloseOutlined style={{ color: '#ff4d4f', marginLeft: 4 }} />
      )}
      <Text type={met ? 'success' : 'danger'}>{children}</Text>
    </div>
  );

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
                        closable
                        onClose={() => setError(null)}
                        style={{ marginBottom: 24 }}
                      />
                    )}
                    <Form 
                      form={form}
                      name="reset_password" 
                      onFinish={onFinish} 
                      layout="vertical"
                    >
                      <Form.Item 
                        name="password"
                        label="رمز عبور جدید"
                        rules={[
                          { required: true, message: 'لطفاً رمز عبور جدید را وارد کنید' },
                          () => ({
                            validator(_, value) {
                              if (!value || validatePasswordStrength(value).isValid) {
                                return Promise.resolve();
                              }
                              return Promise.reject(new Error('لطفاً یک رمز عبور قوی‌تر انتخاب کنید'));
                            },
                          }),
                        ]}
                      >
                        <Input.Password 
                          prefix={<LockOutlined />} 
                          placeholder="رمز عبور جدید" 
                          size="large" 
                          iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                          onChange={handlePasswordChange}
                        />
                      </Form.Item>
                      
                      {passwordStrength.requirements && (
                        <div style={{ marginBottom: 16 }}>
                          <Text strong>قدرت رمز عبور:</Text>
                          <Progress 
                            percent={calculatePasswordStrengthScore(form.getFieldValue('password'))} 
                            showInfo={false} 
                            strokeColor={getPasswordStrengthColor(
                              calculatePasswordStrengthScore(form.getFieldValue('password'))
                            )}
                            size="small"
                          />
                          
                          <Space direction="vertical" size={0} style={{ marginTop: 8 }}>
                            <RequirementItem met={form.getFieldValue('password')?.length >= 8}>
                              حداقل ۸ کاراکتر
                            </RequirementItem>
                            <RequirementItem met={passwordStrength.requirements.hasUpperCase}>
                              دارای حروف بزرگ (A-Z)
                            </RequirementItem>
                            <RequirementItem met={passwordStrength.requirements.hasLowerCase}>
                              دارای حروف کوچک (a-z)
                            </RequirementItem>
                            <RequirementItem met={passwordStrength.requirements.hasNumber}>
                              دارای اعداد (0-9)
                            </RequirementItem>
                            <RequirementItem met={passwordStrength.requirements.hasSpecialChar}>
                              دارای کاراکترهای خاص (!@#$%^&*)
                            </RequirementItem>
                          </Space>
                        </div>
                      )}
                      
                      <Form.Item 
                        name="confirmPassword"
                        label="تکرار رمز عبور جدید"
                        rules={[
                          { required: true, message: 'لطفاً تکرار رمز عبور را وارد کنید' },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              if (!value || getFieldValue('password') === value) {
                                return Promise.resolve();
                              }
                              return Promise.reject(new Error('رمزهای عبور مطابقت ندارند'));
                            },
                          }),
                        ]}
                        dependencies={['password']}
                      >
                        <Input.Password 
                          prefix={<LockOutlined />} 
                          placeholder="تکرار رمز عبور جدید" 
                          size="large"
                          iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                        />
                      </Form.Item>
                      <Form.Item>
                        <Button 
                          type="primary" 
                          htmlType="submit" 
                          loading={loading} 
                          block 
                          size="large"
                          disabled={!token}
                        >
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