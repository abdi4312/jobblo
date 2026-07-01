import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, Trash2 } from 'lucide-react';
import {
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  DatePicker,
  message,
} from 'antd';
import mainLink from '../../api/mainURLs';
import ConfirmDialog from '../../components/Ui/ConfirmDialog';
import { AdminTable } from '../../components/Ui/AdminTable';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

interface Voucher {
  _id: string;
  name: string;
  code: string;
  amount: number;
  type: 'percentage' | 'fixed';
  usageLimit: number;
  targetPlanType: 'all' | 'private' | 'business';
  active: boolean;
  activeDate: string;
  expiresDate: string;
  usedBy: string[];
}

const VoucherPage: React.FC = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(8);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Voucher | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ visible: boolean; voucherId: string }>({
    visible: false,
    voucherId: '',
  });
  const [form] = Form.useForm();

  const fetchCoupons = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await mainLink.get(`/api/coupons?page=${currentPage}&limit=${limit}`);
      if (resp.data) {
        setVouchers(resp.data.coupons);
        setTotalPages(resp.data.totalPages);
      }
    } catch {
      message.error('Failed to fetch coupons');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, limit]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const handleDelete = async () => {
    try {
      await mainLink.delete(`/api/coupons/${deleteConfirm.voucherId}`);
      message.success('Coupon has been deleted.');
      fetchCoupons();
    } catch {
      message.error('Delete failed');
    } finally {
      setDeleteConfirm({ visible: false, voucherId: '' });
    }
  };

  const handleSubmitCoupon = async (values: any) => {
    try {
      const payload = {
        ...values,
        code: values.code?.toUpperCase(),
      };

      if (editingCoupon) {
        await mainLink.put(`/api/coupons/${editingCoupon._id}`, payload);
        message.success('Coupon updated!');
      } else {
        await mainLink.post('/api/coupons', payload);
        message.success('Coupon created!');
      }

      setIsModalOpen(false);
      setEditingCoupon(null);
      form.resetFields();
      fetchCoupons();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || 'Operation failed');
    }
  };

  const handleOpenModal = (coupon: Voucher | null = null) => {
    setEditingCoupon(coupon);
    if (coupon) {
      form.setFieldsValue({
        name: coupon.name,
        code: coupon.code,
        amount: coupon.amount,
        type: coupon.type,
        usageLimit: coupon.usageLimit,
        targetPlanType: coupon.targetPlanType,
        active: coupon.active,
        activeDate: coupon.activeDate ? dayjs(coupon.activeDate) : null,
        expiresDate: coupon.expiresDate ? dayjs(coupon.expiresDate) : null,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        type: 'percentage',
        usageLimit: 0,
        targetPlanType: 'all',
        active: true,
      });
    }
    setIsModalOpen(true);
  };

  const getStatus = (voucher: Voucher) => {
    const isExpired = new Date(voucher.expiresDate) < new Date();
    return !voucher.active || isExpired ? 'Expired' : 'Active';
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => (
        <Text type="secondary" className="font-mono">
          {code}
        </Text>
      ),
    },
    {
      title: 'Usage',
      key: 'usage',
      render: (_: any, record: Voucher) => (
        <Text strong>
          {record.usedBy.length} / {record.usageLimit || '∞'}
        </Text>
      ),
    },
    {
      title: 'Discount',
      key: 'discount',
      render: (_: any, record: Voucher) => (
        <Tag color="blue">
          {record.amount}
          {record.type === 'percentage' ? '%' : ' NOK'}
        </Tag>
      ),
    },
    {
      title: 'Target',
      dataIndex: 'targetPlanType',
      key: 'targetPlanType',
      render: (target: string) => <Tag color="green">{target}</Tag>,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: Voucher) => {
        const status = getStatus(record);
        const color = status === 'Active' ? 'success' : 'error';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: 'Active From',
      dataIndex: 'activeDate',
      key: 'activeDate',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Expires',
      dataIndex: 'expiresDate',
      key: 'expiresDate',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: Voucher) => (
        <Space>
          <Button
            type="primary"
            icon={<Edit3 size={16} />}
            onClick={() => handleOpenModal(record)}
            className="flex items-center"
          >
            Edit
          </Button>
          <Button
            type="primary"
            danger
            icon={<Trash2 size={16} />}
            onClick={() => setDeleteConfirm({ visible: true, voucherId: record._id })}
            className="flex items-center"
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-4">
      <Title level={2}>Coupon Management</Title>

      <AdminTable
        title="Vouchers"
        columns={columns}
        dataSource={vouchers}
        rowKey="_id"
        loading={isLoading}
        pagination={{
          current: currentPage,
          pageSize: limit,
          total: totalPages * limit,
          onChange: (page) => setCurrentPage(page),
        }}
        onAddButtonClick={() => handleOpenModal()}
        addButtonText="Add New Coupon"
      />

      <Modal
        title={editingCoupon ? 'Edit Coupon' : 'Create New Coupon'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingCoupon(null);
          form.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitCoupon}>
          <Form.Item name="name" label="Coupon Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Summer Sale" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="type" label="Discount Type" rules={[{ required: true }]}>
              <Select>
                <Option value="percentage">Percentage (%)</Option>
                <Option value="fixed">Fixed Amount</Option>
              </Select>
            </Form.Item>

            <Form.Item name="usageLimit" label="Usage Limit (0=∞)">
              <InputNumber min={0} className="w-full" placeholder="0" />
            </Form.Item>
          </div>

          <Form.Item name="targetPlanType" label="Valid For Plan Type" rules={[{ required: true }]}>
            <Select>
              <Option value="all">All Plans</Option>
              <Option value="private">Private Plans Only</Option>
              <Option value="business">Business Plans Only</Option>
            </Select>
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="code" label="Code" rules={[{ required: true }]}>
              <Input placeholder="SUMMER26" className="uppercase tracking-wider font-bold" />
            </Form.Item>

            <Form.Item name="amount" label="Discount" rules={[{ required: true }]}>
              <InputNumber min={0} className="w-full" placeholder="5.00" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="activeDate" label="Active From">
              <DatePicker className="w-full" />
            </Form.Item>

            <Form.Item name="expiresDate" label="Expires At" rules={[{ required: true }]}>
              <DatePicker className="w-full" />
            </Form.Item>
          </div>

          <Form.Item name="active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item className="flex justify-end">
            <Space>
              <Button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingCoupon(null);
                  form.resetFields();
                }}
              >
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                {editingCoupon ? 'Update Coupon' : 'Create Coupon'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <ConfirmDialog
        title="Are you sure?"
        description="You won't be able to revert this!"
        confirmText="Yes, delete it!"
        cancelText="Cancel"
        variant="destructive"
        isOpen={deleteConfirm.visible}
        onOpenChange={(open) => !open && setDeleteConfirm({ visible: false, voucherId: '' })}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default VoucherPage;
