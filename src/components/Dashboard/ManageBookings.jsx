import React, { useState } from "react";
import {
  Button,
  Modal,
  Form,
  Select,
  Popconfirm,
  Card,
  Row,
  Col,
  Divider,
  Collapse,
  Empty,
  Spin,
  Space,
  Tag
} from "antd";
import { EditOutlined, DeleteOutlined, ReloadOutlined, DownOutlined, UpOutlined } from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { updateReservationStatus, deleteReservation, createTransaction, fetchReservations } from "../../api/jsonServer";
import { STATUS_CONFIG } from "../../constants/index";
import { useNotification } from "../../context/NotificationContext";
import { supabase } from "../../services/supabaseClient";

const { Option } = Select;
const { Panel } = Collapse;

const ManageBookings = () => {
  const queryClient = useQueryClient();
  const [editModal, setEditModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [form] = Form.useForm();
  const notification = useNotification();

  const { data: reservations = [], isLoading: reservationsLoading } = useQuery({
    queryKey: ['reservations'],
    queryFn: fetchReservations,
    refetchOnWindowFocus: false,
    staleTime: 0,
    cacheTime: 5 * 60 * 1000,
    onError: (err) => {
      notification.error({ message: 'خطا', description: err.message || 'خطا در دریافت اطلاعات رزروها' });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: updateReservationStatus,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['reservations']);
      const previousData = queryClient.getQueryData(['reservations']);
      
      // Optimistic update with exact structure
      queryClient.setQueryData(['reservations'], (old) => 
      old?.map(reservation => 
        reservation.id === variables.id
          ? { 
              ...reservation, 
              status_booking: variables.status,
              updatedAt: new Date().toISOString()
            }
          : reservation
      ) || []
    );
      
      return { previousData };
    },
    onSuccess: (data) => {
      // Merge server response with existing cache
      queryClient.setQueryData(['reservations', data.id], data);
    },
    onError: (error, variables, context) => {
      queryClient.setQueryData(['reservations'], context.previousData);
      notification.error({
        message: "خطا",
        description: error.message || "خطا در به‌روزرسانی وضعیت"
      });
    },
  });

  const deleteBookingMutation = useMutation({
    mutationFn: deleteReservation,
    onSuccess: (response) => {
      // 1. Update local cache immediately
      queryClient.setQueryData(['reservations'], (old) => 
        old?.filter(r => r.id !== response.id) || []
      );
  
      // 2. Invalidate queries to force refresh from server
      queryClient.invalidateQueries({
        queryKey: ['reservations'],
        refetchType: 'active'
      });
  
      // 3. Handle refund if needed
      if (response.data?.status_booking === 'cancelled_refund_pending') {
        createTransaction({
          users_id: response.data.users_id,
          reservationId: response.data.id,
          type: 'refund_processed',
          amount: -response.data.totalPrice,
          status: 'completed',
          description: `Refund for deleted reservation #${response.data.id}`,
        }).then(() => {
          queryClient.invalidateQueries(['allTransactions']);
        });
      }
  
      notification.success({
        message: "موفق",
        description: "رزرو مورد نظر با موفقیت حذف شد"
      });
    },
    onError: (error) => {
      notification.error({
        message: "Error",
        description: error.message
      });
      // Force full refresh
      queryClient.invalidateQueries(['reservations']);
    }
  });

  const handleUpdateStatus = async (values) => {
    if (!selectedBooking?.id) {
      notification.error({ message: "خطا", description: "شناسه رزرو نامعتبر است" });
      return;
    }
  
    try {
      // 1. Update reservation status
      await updateStatusMutation.mutateAsync({
        id: selectedBooking.id,
        status: values.status,
      });

       setTimeout(() => {
      queryClient.invalidateQueries(['reservations']);
    }, 1000);
  
      // 2. Handle refund if needed
      if (values.status === 'cancelled' && selectedBooking.users_id) {
        try {
          await createTransaction({
            users_id: selectedBooking.users_id,
            reservationId: selectedBooking.id,
            type: 'refund_processed',
            amount: -selectedBooking.totalPrice,
            status: 'completed',
            description: `استرداد وجه برای رزرو #${selectedBooking.id}`,
          });
        } catch (transactionError) {
          console.error("خطا در ایجاد تراکنش استرداد:", transactionError);
        }
      }
  
      setEditModal(false);
    } catch (error) {
      console.error("خطا در به‌روزرسانی وضعیت:", error);
    }
  };
  const handleDeleteBooking = async (id) => {
    try {
      const result = await deleteBookingMutation.mutateAsync(id);
      
      // Additional verification after 1 second
      setTimeout(async () => {
        const { data } = await supabase
          .from('reservations')
          .select('id')
          .eq('id', id)
          .maybeSingle();
  
        if (data) {
          console.error('Reservation still exists! Forcing refresh...');
          queryClient.invalidateQueries(['reservations']);
        }
      }, 1000);
  
    } catch (error) {
      console.error('Delete error:', error);
      notification.error({
        message: "Deletion Failed",
        description: error.message,
        duration: 5
      });
      
      // Check if it's an auth error
      if (error.message.includes('permission denied')) {
        notification.warning({
          message: "Permission Issue",
          description: "Please ensure you have proper admin privileges",
          duration: 5
        });
      }
    }
  };

  const refundPendingReservations = reservations.filter(
    r =>
      typeof r.status === 'object' &&
      r.status.booking === 'cancelled_refund_pending'
  );

  const handleRefresh = () => {
    queryClient.invalidateQueries(['reservations']);
  };

  const getStatusTag = (reservation) => {
    const status = reservation?.status_booking || 'pending';
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.default;
    return <Tag color={config.color} icon={config.icon}>{config.text}</Tag>;
  };

  const toggleExpand = (id) => {
    if (expandedKeys.includes(id)) {
      setExpandedKeys(expandedKeys.filter(key => key !== id));
    } else {
      setExpandedKeys([...expandedKeys, id]);
    }
  };

  return (
    <div style={{ padding: '0 8px',maxWidth:'100%', overflowX:'hidden' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',flexWrap: 'wrap' }}>
      <h2 style={{ 
          margin: 0, 
          fontSize: 'clamp(16px, 4vw, 18px)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>مدیریت رزروها</h2>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          loading={reservationsLoading}
          size="small"
          style={{ marginTop: '4px' }}
        >
          <span className="responsive-text">بارگذاری مجدد</span>
        </Button>
      </div>

      {reservationsLoading ? (
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <Spin size="large" />
        </div>
      ) : reservations.length === 0 ? (
        <Empty description="هیچ رزروی یافت نشد" />
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {reservations.map(record => (
            <Card
              key={record.id}
              title={<span style={{ 
                fontSize: 'clamp(10px, 2.5vw, 14px)',
                display: 'inline-block',
                width: '100%',
                textAlign: 'center'
              }}>
                رزرو شماره: {record.id}
              </span>}
              extra={<div style={{ textAlign: 'center' }}>
              {getStatusTag(record)}
            </div>}
              style={{ width: '100%',minWidth: '280px' }}
              headStyle={{ 
                padding: '0 8px',
                textAlign: 'center'
              }}
              bodyStyle={{ 
                padding: '12px 8px'
              }}
              actions={[
                <Button
                  type="text"
                  size="small"
                  icon={expandedKeys.includes(record.id) ? <UpOutlined /> : <DownOutlined />}
                  onClick={() => toggleExpand(record.id)}
                >
                  <span className="responsive-text">
                    {expandedKeys.includes(record.id) ? 'بستن' : 'جزئیات'}
                  </span>
                </Button>,
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setSelectedBooking(record);
                    form.setFieldsValue({ status: record.status });
                    setEditModal(true);
                  }}
                >
                  <span className="responsive-text">تغییر</span>
                </Button>,
                <Popconfirm
                  title="آیا از حذف این رزرو اطمینان دارید؟"
                  onConfirm={() => handleDeleteBooking(record.id)}
                  okText="بله"
                  cancelText="خیر"
                >
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    loading={deleteBookingMutation.isLoading && deleteBookingMutation.variables === record.id}
                  >
                    <span className="responsive-text">حذف</span>
                  </Button>
                </Popconfirm>
              ]}
            >
              <Row gutter={[8, 8]}>
                <Col xs={24} sm={12} md={8}>
                  <div>
                    <strong style={{ color: 'Highlight', fontSize: '12px' }}>نام مهمان: </strong>
                    <span style={{ fontSize: '12px' }}>
                      {record?.users?.firstName || 'نامشخص'} {record?.users?.lastName || ''}
                      {!record?.users?.firstName && !record?.users?.lastName && record.hotelName && record.hotelName}
                    </span>
                  </div>
                  <div>
                    <strong style={{ color: 'violet', fontSize: '12px' }}>هتل: </strong>
                    <span style={{ fontSize: '12px' }}>{record?.hotel?.name || record.hotelName || "نامشخص"}</span>
                  </div>
                </Col>

                <Col xs={24} sm={12} md={8}>
                  <div>
                    <strong style={{ color: 'springgreen', fontSize: '12px' }}>تاریخ ورود: </strong>
                    <span style={{ fontSize: '12px' }}>{record.checkIn.replace(/-/g, '/') || "نامشخص"}</span>
                  </div>
                  <div>
                    <strong style={{ color: 'red', fontSize: '12px' }}>تاریخ خروج: </strong>
                    <span style={{ fontSize: '12px' }}>{record.checkOut?.replace(/-/g, '/') || 'نامشخص'}</span>
                  </div>
                </Col>

                <Col xs={24} sm={12} md={8}>
                  <div>
                    <strong style={{ color: 'yellowgreen', fontSize: '12px' }}>مبلغ: </strong>
                    <span style={{ fontSize: '12px' }}>
                      {((record.totalPrice || 0)).toLocaleString('fa-IR')} تومان
                    </span>
                  </div>
                </Col>
              </Row>

              {expandedKeys.includes(record.id) && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <Row gutter={[8, 8]}>
                    <Col xs={24} sm={12} md={12}>
                      <Card size="small" title="اطلاعات رزرو" headStyle={{ fontSize: '12px' }} bodyStyle={{ padding: '8px' }}>
                        <p style={{ marginBottom: '8px', fontSize: '12px' }}>تعداد بزرگسال: {record.guests?.adults || 1}</p>
                        <p style={{ marginBottom: '8px', fontSize: '12px' }}>تعداد کودک: {record.guests?.children || 0}</p>
                        <p style={{ marginBottom: '0', fontSize: '12px' }}>تاریخ ثبت: {(record.checkIn)?.replace(/-/g, '/') || "نامشخص"}</p>
                      </Card>
                    </Col>

                    <Col xs={24} sm={12} md={12}>
                      <Card size="small" title="اطلاعات مهمان" headStyle={{ fontSize: '12px' }} bodyStyle={{ padding: '8px' }}>
                        <p style={{ marginBottom: '8px', fontSize: '12px' }}>نام: {record.users?.firstName || 'نامشخص'} {record.users?.lastName || ''}</p>
                        <p style={{ marginBottom: '8px', fontSize: '12px' }}>ایمیل: {record.users?.email || "نامشخص"}</p>
                        <p style={{ marginBottom: '0', fontSize: '12px' }}>تلفن: {record.users?.phoneNumber || "نامشخص"}</p>
                      </Card>
                    </Col>
                  </Row>
                </>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        title="تغییر وضعیت رزرو"
        visible={editModal}
        onCancel={() => {
          setEditModal(false);
          form.resetFields();
        }}
        footer={null}
        width={window.innerWidth < 768 ? '90%' : '50%'}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdateStatus}
          initialValues={{
            status: selectedBooking?.status_booking
          }}
        >
          <Form.Item
            name="status"
            label="وضعیت"
            rules={[{ required: true, message: "لطفاً وضعیت را انتخاب کنید" }]}
          >
            <Select size="large">
              <Option value="confirmed">تایید شده</Option>
              <Option value="pending">در انتظار</Option>
              <Option value="cancelled">لغو شده</Option>
              <Option value="cancelled_refund_pending">در انتظار بازپرداخت</Option>
              <Option value="refund_processed">بازپرداخت شده</Option>
            </Select>
          </Form.Item>

          <Form.Item className="text-right">
            <Space>
              <Button
                onClick={() => {
                  setEditModal(false);
                  form.resetFields();
                }}
                size={window.innerWidth < 768 ? 'middle' : 'large'}
              >
                انصراف
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateStatusMutation.isLoading}
                size={window.innerWidth < 768 ? 'middle' : 'large'}
              >
                ثبت تغییرات
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ManageBookings;