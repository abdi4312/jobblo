import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, CheckCircle2, XCircle, RotateCcw, Clock } from 'lucide-react';
import { Table, Button, Card, Space, Tag, Typography, Select, message } from 'antd';
import mainLink from '../../api/mainURLs';
import ConfirmDialog from '../../components/Ui/ConfirmDialog';

const { Title, Text } = Typography;
const { Option } = Select;

interface Transaction {
  _id: string;
  user?: { name?: string; email?: string };
  plan?: { name?: string };
  type?: string;
  amount?: number;
  status?: string;
  refunded?: boolean;
  createdAt?: string;
}

const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [statusUpdate, setStatusUpdate] = useState<{ visible: boolean; id: string; newStatus: string }>({ visible: false, id: '', newStatus: '' });

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await mainLink.get(
        `/api/admin/transactions?page=${currentPage}&limit=${limit}&search=${searchQuery}&type=${selectedType}`
      );
      setTransactions(response.data?.transactions || []);
      setTotalPages(response.data?.totalPages || 1);
    } catch (error) {
      console.error('Fetch error:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, searchQuery, selectedType]);

  const handleUpdateStatus = async () => {
    try {
      await mainLink.patch(`/api/admin/transactions/${statusUpdate.id}/status`, {
        status: statusUpdate.newStatus,
      });

      // Refresh the list
      fetchTransactions();
      message.success(`Transaction status changed to ${statusUpdate.newStatus}`);
      setStatusUpdate({ visible: false, id: '', newStatus: '' });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      console.error('Update failed:', error);
      message.error(err.response?.data?.message || 'Failed to update status.');
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchTransactions();
    }, 500);

    return () => clearTimeout(handler);
  }, [fetchTransactions]);

  const getStatusConfig = (
    status: string
  ): { label: string; color: string; icon: React.ReactNode } => {
    switch (status) {
      case 'succeeded':
        return {
          label: 'Succeeded',
          color: 'success',
          icon: <CheckCircle2 size={14} />,
        };
      case 'failed':
        return {
          label: 'Failed',
          color: 'error',
          icon: <XCircle size={14} />,
        };
      case 'refunded':
        return {
          label: 'Refunded',
          color: 'default',
          icon: <RotateCcw size={14} />,
        };
      default:
        return {
          label: 'Pending',
          color: 'warning',
          icon: <Clock size={14} />,
        };
    }
  };

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_: any, record: Transaction) => (
        <Space direction="vertical" size="small">
          <Text strong>{record.user?.name || 'N/A'}</Text>
          <Text type="secondary" className="text-xs">{record.user?.email || ''}</Text>
        </Space>
      ),
    },
    {
      title: 'Plan',
      dataIndex: ['plan', 'name'],
      key: 'plan',
      render: (name: string) => name || 'N/A',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => <Text strong>{amount} NOK</Text>,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: Transaction) => {
        const config = getStatusConfig(record.status || '');
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: Transaction) => (
        <Select
          defaultValue={record.status}
          style={{ width: 120 }}
          onChange={(value) => {
            const confirmMessage =
              value === 'refunded'
                ? 'Are you sure? This will also mark the transaction as refunded in the system.'
                : `Change status to ${value}?`;
            setStatusUpdate({ visible: true, id: record._id, newStatus: value });
          }}
        >
          <Option value="pending">Pending</Option>
          <Option value="succeeded">Succeeded</Option>
          <Option value="failed">Failed</Option>
          <Option value="refunded">Refunded</Option>
        </Select>
      ),
    },
  ];

  return (
    <div className="p-4">
      <Title level={2}>Transactions</Title>
      <Text type="secondary" className="block mb-8">
        Manage and track all customer payments
      </Text>

      <Card title="Transactions" className="shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search ID or Email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm w-full outline-none focus:border-[#2d4a3e]"
              />
            </div>
            <Select
              placeholder="All Transactions"
              value={selectedType || undefined}
              onChange={(value) => {
                setSelectedType(value);
                setCurrentPage(1);
              }}
              style={{ width: 200 }}
              suffixIcon={<Filter size={16} />}
            >
              <Option value="">All Transactions</Option>
              <Option value="subscription">Subscriptions</Option>
              <Option value="extra_contact">Extra Contacts</Option>
            </Select>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={transactions}
          rowKey="_id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: limit,
            total: totalPages * limit,
            onChange: (page) => setCurrentPage(page),
          }}
        />
      </Card>

      <ConfirmDialog
        title="Confirm Status Update"
        description={
          statusUpdate.newStatus === 'refunded'
            ? 'Are you sure? This will also mark the transaction as refunded in the system.'
            : `Change status to ${statusUpdate.newStatus}?`
        }
        confirmText="Yes, update it!"
        cancelText="Cancel"
        isOpen={statusUpdate.visible}
        onOpenChange={(open) => !open && setStatusUpdate({ visible: false, id: '', newStatus: '' })}
        onConfirm={handleUpdateStatus}
      />
    </div>
  );
};

export default TransactionsPage;
