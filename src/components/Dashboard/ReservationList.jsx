import React, { useState, useEffect } from "react";
import {
  Row,
  Col,
  Card,
  Tag,
  Button,
  Typography,
  Spin,
  Space,
  Empty,
  Divider,
  Modal,
  Alert
} from "antd";
import {
  CalendarOutlined,
  HomeOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTransaction,
  updateReservation,
  fetchTransactionsForReservation,
  fetchUserReservations
} from "../../api/jsonServer";
import "../../styles/ReservationList.css";
import { STATUS_CONFIG } from "../../constants/index";
import {
  smartDateParser,
  getNowJalali,
  getDaysDifference
} from '../../utils/dateUtils';
import dayjs from "dayjs";
import { useNotification } from "../../context/NotificationContext";
import {useAuth} from '../../context/AuthContext'

const { Text, Title, Paragraph } = Typography;

const ReservationList = () => {
  const [processingId, setProcessingId] = useState(null);
  const [isCancelModalVisible, setIsCancelModalVisible] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const notification = useNotification();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['userReservations', user?.id], 
    queryFn: () => fetchUserReservations(user?.id),
    enabled: !!user?.id
  });


  const getStatusTag = (status_booking) => {
    const config = STATUS_CONFIG[status_booking] || STATUS_CONFIG.default;
    return <Tag color={config.color} icon={config.icon}>{config.text}</Tag>;
  };

  const showCancelModal = (reservation) => {
    setSelectedReservation(reservation);
    setIsCancelModalVisible(true);
  };


  const calculateRefund = (reservation) => {
    if (!reservation?.checkIn) {
      return { refundAmount: 0, message: "تاریخ ورود نامعتبر است." };
    }

    try {
      const now = getNowJalali();
      const checkInDate = smartDateParser(reservation.checkIn);

      if (!dayjs.isDayjs(checkInDate)) {
        throw new Error(`تاریخ نامعتبر: ${reservation.checkIn}`);
      }

      const daysUntilCheckIn = getDaysDifference(checkInDate, now);
      let refundAmount = 0;
      let message = "طبق قوانین، در این بازه زمانی مبلغی بازپرداخت نخواهد شد.";

      if (daysUntilCheckIn > 7) {
        refundAmount = Math.floor(reservation.totalPrice * 0.9);
        message = `لغو با بیش از ۷ روز فاصله: ۹۰٪ بازپرداخت (${refundAmount.toLocaleString('fa-IR')} تومان)`;
      } else if (daysUntilCheckIn > 2) {
        refundAmount = Math.floor(reservation.totalPrice * 0.5);
        message = `لغو با ۳ تا ۷ روز فاصله: ۵۰٪ بازپرداخت (${refundAmount.toLocaleString('fa-IR')} تومان)`;
      }

      return { refundAmount, message };
    } catch (error) {
      console.error('Refund calculation error:', error);
      return {
        refundAmount: 0,
        message: "خطا در سیستم محاسبه. لطفاً با پشتیبانی تماس بگیرید."
      };
    }
  };

  const handleConfirmCancellation = async () => {
    if (!selectedReservation?.id) {
      notification.error({
        message: "خطا",
        description: "رزرو نامعتبر است یا انتخاب نشده است.",
      });
      return;
    }

    const { id, user_id } = selectedReservation;
    // تغییر اصلی: خواندن مستقیم از ستون status_booking
    const bookingStatus = selectedReservation.status_booking;
    const eligibleForRefund = ['confirmed', 'pending'].includes(bookingStatus);

    try {
      setProcessingId(id);

      // استفاده از تابع جدید برای چک کردن تراکنش‌ها
      const existingTransactions = await fetchTransactionsForReservation(id);
      if (existingTransactions.some(t => t.type === 'refund_request' && ['pending', 'completed'].includes(t.status))) {
        notification.warning({
          message: 'درخواست بازپرداخت قبلاً ثبت شده',
          description: 'برای این رزرو قبلاً درخواست بازپرداخت ثبت شده است.'
        });
        setIsCancelModalVisible(false);
        return;
      }

      if (eligibleForRefund) {
        const { refundAmount, message: refundMessage } = calculateRefund(selectedReservation);

        if (refundAmount > 0) {
          // درخواست بازپرداخت ثبت می‌شود
          await Promise.all([
            createTransaction({ // استفاده از تابع جدید Supabase
              user_id,
              reservationId: id,
              type: 'refund_request',
              amount: -refundAmount,
              status: 'pending',
              description: `درخواست بازپرداخت برای رزرو #${id} - ${refundMessage}`,
            }),
            updateReservation({ // استفاده از تابع جدید Supabase
              id: selectedReservation.id,
              status_booking: 'cancelled_refund_pending' // آپدیت ستون مسطح
            })
          ]);

          notification.success({
            message: 'درخواست بازپرداخت ثبت شد',
            description: `درخواست بازپرداخت به مبلغ ${refundAmount.toLocaleString('fa-IR')} تومان ثبت شد.`
          });
        } else {
          // کنسلی بدون بازپرداخت
          await updateReservation({
            id: selectedReservation.id,
            status_booking: 'cancelled'
          });

          notification.success({
            message: 'رزرو لغو شد',
            description: 'رزرو با موفقیت لغو شد (بدون بازپرداخت).'
          });
        }
      } else {
        // کنسلی برای رزروهایی که واجد شرایط بازپرداخت نیستند
        await updateReservation({
          id: selectedReservation.id,
          status_booking: 'cancelled'
        });

        notification.success({
          message: 'رزرو لغو شد',
          description: 'رزرو با موفقیت لغو شد.'
        });
      }

      // React Query را برای همگام‌سازی دوباره داده‌ها فراخوانی می‌کنیم
      queryClient.invalidateQueries({ queryKey: ['userReservations',user?.id] });
      queryClient.invalidateQueries({ queryKey: ['allTransactions'] });

    } catch (error) {
      console.error('Cancellation error:', error);
      notification.error({
        message: 'خطا در لغو رزرو',
        description: error.message || 'خطا در پردازش درخواست لغو'
      });
      // در صورت خطا نیز داده‌ها را دوباره همگام می‌کنیم
      queryClient.invalidateQueries({ queryKey: ['userReservations'] });
    } finally {
      setProcessingId(null);
      setIsCancelModalVisible(false);
      setSelectedReservation(null);
    }
  };


  const isReservationExpired = (reservation) => {
    try {
      const now = getNowJalali();
      const checkInDate = smartDateParser(reservation.checkIn);

      if (!checkInDate.isValid()) return false;

      const isPastCheckIn = getDaysDifference(checkInDate, now) < 0;

      const bookingStatus = reservation.status_booking
      return isPastCheckIn &&
        !['cancelled', 'cancelled_refund_pending', 'refund_processed'].includes(bookingStatus);
    } catch (e) {
      console.error('Date parsing error:', e);
      return false;
    }
  };


  if (isLoading) {
    return <div className="loading-container"><Spin size="large" /></div>;
  }
  if (!reservations.length) {
    return <Empty description={<span className="empty-message">هیچ رزروی یافت نشد</span>} />;
  }

  return (
    <>
      <div className="reservation-list-container">
        <Row gutter={[24, 24]}>
          {reservations.map((reservation) => {
            const status = reservation.status;
            const bookingStatus = reservation.status_booking;
            const isCancelled = ['cancelled', 'cancelled_refund_pending', 'refund_processed'].includes(bookingStatus);

            return (
              <Col xs={24} md={12} key={reservation.id}>
                <Card
                  hoverable
                  className="reservation-card"
                  bodyStyle={{ padding: 0 }}
                  actions={[
                    <Button
                      danger
                      icon={isCancelled ? <CloseCircleOutlined /> : null}
                      onClick={() => showCancelModal(reservation)}
                      disabled={
                        processingId === reservation.id ||
                        ['cancelled', 'cancelled_refund_pending', 'refund_processed', 'completed'].includes(reservation.status_booking)||
                        isReservationExpired(reservation)
                      }
                      loading={processingId === reservation.id}
                    >
                      {processingId === reservation.id
                        ? 'در حال پردازش...'
                        : isCancelled
                          ? 'لغو شده'
                          : isReservationExpired(reservation)
                            ? 'منقضی شده'
                            : 'لغو رزرو'}
                    </Button>
                  ]}
                >
                  <div className="card-header">
                    {getStatusTag(reservation.status_booking)}
                    <Text type="secondary">#{reservation.id}</Text>
                  </div>
                  <div className="card-body">
                    <Title level={5} ellipsis>
                      <HomeOutlined style={{ marginLeft: 8 }} />
                      {reservation.hotelName}
                    </Title>
                    <Divider className="card-divider" />
                    <Row gutter={[16, 16]}>
                      <Col span={12}><Text type="secondary"><CalendarOutlined /> ورود:</Text></Col>
                      <Col span={12}><Text strong>{reservation.checkIn.replace(/-/g, '/')}</Text></Col>
                      <Col span={12}><Text type="secondary"><CalendarOutlined /> خروج:</Text></Col>
                      <Col span={12}><Text strong>{reservation.checkOut.replace(/-/g, '/')}</Text></Col>
                      <Col span={12}><Text type="secondary">مبلغ نهایی:</Text></Col>
                      <Col span={12}>
                        <Text strong className="total-price-value">
                          {Number(reservation.totalPrice).toLocaleString("fa-IR")} تومان
                        </Text>
                      </Col>
                    </Row>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      </div>

      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            تایید نهایی لغو رزرو
          </Space>
        }
        open={isCancelModalVisible}
        onCancel={() => setIsCancelModalVisible(false)}
        footer={[
          <Button key="back" onClick={() => setIsCancelModalVisible(false)}>
            انصراف
          </Button>,
          <Button
            key="submit"
            type="primary"
            danger
            loading={processingId === selectedReservation?.id}
            onClick={handleConfirmCancellation}
            icon={<CheckCircleOutlined />}
          >
            تایید و لغو رزرو
          </Button>,
        ]}
      >
        {selectedReservation && (() => {
          const { message: refundMessage, refundAmount } = calculateRefund(selectedReservation);
          const statusObj = selectedReservation?.status || {};
          const bookingStatus = typeof statusObj === 'object' ? statusObj.booking : statusObj;
          const eligibleForRefund = ['confirmed', 'pending'].includes(bookingStatus);

          return (
            <div>
              <Title level={5}>قوانین کنسلی و بازپرداخت وجه:</Title>
              <Paragraph>{refundMessage}</Paragraph>
              <Divider />
              {eligibleForRefund ? (
                refundAmount > 0 ? (
                  <Alert
                    message="توجه"
                    description={`این رزرو واجد شرایط بازپرداخت به مبلغ ${refundAmount.toLocaleString('fa-IR')} تومان می‌باشد.`}
                    type="info"
                    showIcon
                  />
                ) : (
                  <Alert
                    message="توجه"
                    description="این رزرو واجد شرایط بازپرداخت نمی‌باشد اما همچنان می‌توانید آن را لغو کنید."
                    type="warning"
                    showIcon
                  />
                )
              ) : (
                <Alert
                  message="توجه"
                  description="لغو با بیش از 7 روز فاصله 90% مبلغ عودت داده می شود و لغو با 3 تا 7 روز فاصله 50% مبلغ عودت داده میشود"
                  type="warning"
                  showIcon
                />
              )}
            </div>
          );
        })()}
      </Modal>
    </>
  );
};

export default ReservationList;