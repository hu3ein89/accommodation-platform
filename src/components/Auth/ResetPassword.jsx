import React, { useState } from 'react';
import { Form, Input, Button, Card, Layout, Row, Col, Alert, Typography, Progress, Space } from 'antd';
import { LockOutlined, EyeInvisibleOutlined, EyeTwoTone, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { validatePasswordStrength } from '../../utils/authHelper';

const { Content } = Layout;
const { Title, Text } = Typography;

const ResetPassword = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ isValid: false, requirements: null });
  const [form] = Form.useForm();

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
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSuccess(true);
    } catch (err) {
      console.error('Password reset error:', err);
      setError('خطا در تغییر رمز عبور');
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
    <Layout style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
      <Content>
        <Row justify="center" align="middle" style={{ height: '100vh', padding: '16px' }}>
          <Col xs={24} sm={20} md={16} lg={12} xl={8}>
            <Card 
              bordered={false} 
              style={{
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                padding: '24px'
              }}
            >
              <Title 
                level={2} 
                style={{ 
                  textAlign: 'center', 
                  marginBottom: '24px',
                  color: '#1890ff'
                }}
              >
                تغییر رمز عبور
              </Title>
              
              {success ? (
                <Alert
                  message="رمز عبور با موفقیت تغییر کرد"
                  description="اکنون می‌توانید با رمز عبور جدید وارد شوید"
                  type="success"
                  showIcon
                  style={{ marginBottom: 24 }}
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
                        style={{ borderRadius: '6px' }}
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
                        style={{ borderRadius: '6px' }}
                      />
                    </Form.Item>
                    <Form.Item>
                      <Button 
                        type="primary" 
                        htmlType="submit" 
                        loading={loading} 
                        block 
                        size="large"
                        style={{
                          height: '48px',
                          borderRadius: '6px',
                          fontSize: '16px',
                          fontWeight: 'bold'
                        }}
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
      </Content>
      
      <style>
        {`
          .ant-input-affix-wrapper {
            direction: rtl;
          }
          .ant-input-prefix {
            margin-right: 0;
            margin-left: 8px;
          }
          .ant-form-item-label {
            text-align: right;
          }
          .ant-form-item-label > label {
            font-weight: bold;
          }
          .ant-card-body {
            padding: 32px;
          }
        `}
      </style>
    </Layout>
  );
};

export default ResetPassword;