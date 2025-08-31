import React, { useState } from "react";
import {
    Button,
    Modal,
    Form,
    Input,
    Select,
    notification,
    Popconfirm,
    Badge,
    Card,
    Row,
    Col,
    Space,
    Divider,
    Empty,
    Spin,
    Avatar,
    Typography
} from "antd";
import {
    UserOutlined,
    EditOutlined,
    DeleteOutlined,
    SearchOutlined
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchUsers, updateUser, deleteUser } from "../../api/data";

const { Option } = Select;
const { Text } = Typography;

const ManageUsers = () => {
    const queryClient = useQueryClient();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [form] = Form.useForm();
    const [searchText, setSearchText] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: fetchUsers,
    });

    const updateUserMutation = useMutation({
        mutationFn: ({ user_id, userData }) => updateUser(user_id, userData),
        onSuccess: (updatedUser) => {
            queryClient.invalidateQueries(['users']);
            notification.success({
                message: 'Update Successful',
                description: `User ${updatedUser.email} updated`
            });
            setIsModalVisible(false);
        },
        onError: (error) => {
            notification.error({
                message: 'Update Failed',
                description: error.message
            });
        }
    });
    const deleteUserMutation = useMutation({
        mutationFn: (user_id) => deleteUser(user_id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            notification.success({ message: 'کاربر با موفقیت حذف شد' });
        },
        onError: (error) => {
            notification.error({ message: 'خطا در حذف کاربر!', description: error.message });
        }
    });

    const filteredData = users.filter((user) => {
        if (!user || !user.firstName || !user.lastName || !user.email) return false;
        const lowercasedSearch = searchText.toLowerCase();
        const matchesSearchText =
            user.firstName.toLowerCase().includes(lowercasedSearch) ||
            user.lastName.toLowerCase().includes(lowercasedSearch) ||
            user.email.toLowerCase().includes(lowercasedSearch);

        const userRole = user.role?.toLowerCase() || 'guest';
        const matchesRoleFilter = roleFilter === 'all' || userRole === roleFilter;
        const matchesStatusFilter = statusFilter === 'all' || user.status === statusFilter;

        return matchesSearchText && matchesRoleFilter && matchesStatusFilter && user.status !== 'deleted';
    });

    const showUserModal = (user = null) => {
        setEditingUser(user);

        if (user) {
            // Prepare initial form values with proper defaults
            const initialValues = {
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || '',
                phoneNumber: user.phoneNumber || '',
                role: (user.role || 'Guest').toLowerCase(),
                status: user.status || 'active'
            };

            // Set form values and validate
            form.setFieldsValue(initialValues);

            // Reset any validation states
            form.validateFields().catch(() => { });
        } else {
            // Clear form for new user creation
            form.resetFields();
        }

        setIsModalVisible(true);
    };

    const handleFormSubmit = async (values) => {
        try {
            if (!editingUser?.id) {
                notification.error({ message: 'خطا', description: 'کاربری انتخاب نشده است' });
                return;
            }

            const updatePayload = {
                firstName: values.firstName,
                lastName: values.lastName,
                email: values.email,
                phoneNumber: values.phoneNumber,
                role: values.role === 'hotel manager' ? 'Hotel Manager' : 'Guest',
                status: values.status
            };

            await updateUserMutation.mutateAsync({
                userData: updatePayload,
                user_id: editingUser.id
            });

        } catch (error) {
            console.error('Update error:', error);
            notification.error({
                message: 'خطا',
                description: error.message || 'مشکلی در به‌روزرسانی اطلاعات پیش آمد'
            });
        }
    };

    const handleUserDelete = async (user_id) => {
        deleteUserMutation.mutate(user_id);
    };

    const getStatusBadge = (status) => {
        const color = status === 'active' ? 'green' : 'red';
        const text = status === 'active' ? 'فعال' : 'غیرفعال';
        return <Badge color={color} text={text} />;
    };

    const getRoleBadge = (role) => {
        const normalizedRole = typeof role === 'string' ? role.toLowerCase() : '';
        switch (normalizedRole) {
            case 'hotel manager':
                return <Badge color="gold" text="مدیر" />;
            case 'guest':
            default:
                return <Badge color="purple" text="کاربر" />;
        }
    };

    return (
        <div style={{ padding: '16px' }}>
            <Card
                title="مدیریت کاربران"
                style={{ marginBottom: 16 }}
            >
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} md={8}>
                        <Input
                            placeholder="جستجوی کاربر..."
                            prefix={<SearchOutlined />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            allowClear
                        />
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                        <Select
                            placeholder="فیلتر بر اساس نقش"
                            style={{ width: '100%' }}
                            value={roleFilter}
                            onChange={setRoleFilter}
                            allowClear
                        >
                            <Option value="all">همه نقش‌ها</Option>
                            <Option value="hotel manager">مدیر</Option>
                            <Option value="guest">کاربر</Option>
                        </Select>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                        <Select
                            placeholder="فیلتر بر اساس وضعیت"
                            style={{ width: '100%' }}
                            value={statusFilter}
                            onChange={setStatusFilter}
                            allowClear
                        >
                            <Option value="all">همه وضعیت‌ها</Option>
                            <Option value="active">فعال</Option>
                            <Option value="inactive">غیرفعال</Option>
                        </Select>
                    </Col>
                </Row>
            </Card>

            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '24px' }}>
                    <Spin size="large" />
                </div>
            ) : filteredData.length === 0 ? (
                <Empty description="هیچ کاربری یافت نشد" />
            ) : (
                <Row gutter={[16, 16]}>
                    {filteredData.map(user => (
                        <Col xs={24} sm={12} md={8} lg={6} key={user.id}>
                            <Card
                                actions={[
                                    <Button
                                        type="text"
                                        icon={<EditOutlined />}
                                        onClick={() => showUserModal(user)}
                                    >
                                        ویرایش
                                    </Button>,
                                    <Popconfirm
                                        title="آیا از حذف این کاربر مطمئن هستید؟"
                                        onConfirm={() => handleUserDelete(user.id)}
                                        okText="بله"
                                        cancelText="خیر"
                                    >
                                        <Button
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            loading={deleteUserMutation.isPending && deleteUserMutation.variables === user.id}
                                        >
                                            حذف
                                        </Button>
                                    </Popconfirm>
                                ]}
                            >
                                <Space direction="vertical" align="center" style={{ width: '100%' }}>
                                    <Avatar
                                        size={48}
                                        icon={<UserOutlined />}
                                        style={{
                                            backgroundColor: user.role?.toLowerCase() === 'hotel manager' ? '#faad14' : '#722ed1'
                                        }}
                                    />
                                    <div style={{ textAlign: 'center' }}>
                                        <Text strong>{user.firstName} {user.lastName}</Text>
                                        <br />
                                        <Text type="secondary">{user.email}</Text>
                                    </div>
                                    <Divider style={{ margin: '8px 0' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                        <Text type="secondary">نقش:</Text>
                                        {getRoleBadge(user.role)}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                        <Text type="secondary">وضعیت:</Text>
                                        {getStatusBadge(user.status)}
                                    </div>
                                </Space>
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}

            <Modal
                title="ویرایش کاربر"
                visible={isModalVisible}
                onCancel={() => {
                    setIsModalVisible(false);
                    setEditingUser(null);
                    form.resetFields();
                }}
                footer={null}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFormSubmit}
                >
                    <Form.Item name="firstName" label="نام" rules={[{ required: true, message: 'لطفا نام را وارد کنید!' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="lastName" label="نام خانوادگی" rules={[{ required: true, message: 'لطفا نام خانوادگی را وارد کنید!' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="email" label="ایمیل" rules={[{ required: true, message: 'لطفا ایمیل را وارد کنید!' }, { type: 'email', message: 'لطفا یک ایمیل معتبر وارد کنید!' }]}>
                        <Input />
                    </Form.Item>
                    
                    <Form.Item
                        name="phoneNumber"
                        label="شماره تماس"
                        direction='rtl'
                        rules={[
                            { required: true },
                        ]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item name="role" label="نقش" rules={[{ required: true, message: 'لطفا نقش را انتخاب کنید!' }]}>
                        <Select>
                            <Option value="hotel manager">مدیر</Option>
                            <Option value="guest">کاربر</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="status" label="وضعیت" rules={[{ required: true, message: 'لطفا وضعیت را انتخاب کنید!' }]}>
                        <Select>
                            <Option value="active">فعال</Option>
                            <Option value="inactive">غیرفعال</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item style={{ textAlign: 'right' }}>
                        <Space>
                            <Button onClick={() => setIsModalVisible(false)}>
                                انصراف
                            </Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={updateUserMutation.isPending}
                            >
                                ویرایش
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default ManageUsers;