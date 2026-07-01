import React, { useState, useEffect } from 'react';
import { Bell, Info, AlertTriangle, Tag, Plus, X } from 'lucide-react';
import { Button, Space, Tag as AntTag, Typography, Modal, Form, Input, Select, message } from 'antd';
import mainLink from '../../api/mainURLs';
import ConfirmDialog from '../../components/Ui/ConfirmDialog';
import { AdminTable } from '../../components/Ui/AdminTable';

const { Title, Text } = Typography;
const { Option } = Select;

const NotificationsPage = () => {
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sendConfirm, setSendConfirm] = useState<{ visible: boolean; data: any }>({ visible: false, data: null });
  const [form] = Form.useForm();

  const notificationTypes = [
    {
      id: 'system_update',
      label: 'Update',
      icon: <Info size={16} />,
      color: 'blue',
    },
    {
      id: 'alert',
      label: 'Alert',
      icon: <AlertTriangle size={16} />,
      color: 'red',
    },
    {
      id: 'promotion',
      label: 'Offer',
      icon: <Tag size={16} />,
      color: 'orange',
    },
    {
      id: 'general',
      label: 'General',
      icon: <Bell size={16} />,
      color: 'default',
    },
  ];

  const fetchHistory = async (pageNum = 1) => {
    try {
      setHistoryLoading(true);
      const response = await mainLink.get(`/api/admin/system-history?page=${pageNum}&limit=5`);
      setHistory(response.data.data);
      setTotalPages(response.data.totalPages);
      setPage(response.data.currentPage);
    } catch (error) {
      console.error('History fetch error:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSendConfirm = async (values: any) => {
    setSendConfirm({ visible: true, data: values });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await mainLink.post('/api/notifications/system', {
        ...sendConfirm.data,
        isSystem: true,
        userId: null,
      });
      message.success(response.data.message);
      form.resetFields();
      setShowForm(false);
      fetchHistory(1);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || 'Failed to send');
    } finally {
      setLoading(false);
      setSendConfirm({ visible: false, data: null });
    }
  };

  const getTypeInfo = (type: string) => {
    return notificationTypes.find(t => t.id === type) || notificationTypes[3];
  };

  const columns = [
    {
      title: 'Type',
      key: 'type',
      render: (_: any, record: any) => {
        const typeInfo = getTypeInfo(record.type);
        return (
          <Space>
            {typeInfo.icon}
            <AntTag color={typeInfo.color}>{typeInfo.label}</AntTag>
          </Space>
        );
      },
    },
    {
      title: 'Content',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: 'Created',
      key: 'created',
      render: (_: any, record: any) => (
        <Text type="secondary" className="text-xs">
          {new Date(record.createdAt).toLocaleDateString()}
        </Text>
      ),
    },
  ];

  const topSection = showForm ? (
    <div className="w-full mb-6 p-6 bg-gray-50 rounded-xl">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSendConfirm}
        initialValues={{ type: 'system_update' }}
      >
        <Form.Item
          name="type"
          label="Notification Type"
          rules={[{ required: true }]}
        >
          <Select>
            {notificationTypes.map(type => (
              <Option key={type.id} value={type.id}>
                <Space>
                  {type.icon}
                  {type.label}
                </Space>
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="content"
          label="Notification Content"
          rules={[{ required: true }]}
        >
          <Input.TextArea rows={3} placeholder="Enter notification content..." />
        </Form.Item>

        <Form.Item className="flex justify-end">
          <Button type="primary" htmlType="submit">
            Send Notification
          </Button>
        </Form.Item>
      </Form>
    </div>
  ) : null;

  return (
    <div className="p-4">
      <Title level={2}>System Notifications</Title>
      <Text type="secondary" className="block mb-8">
        Manage global broadcasts
      </Text>

      <AdminTable
        title="Notifications"
        columns={columns}
        dataSource={history}
        rowKey="_id"
        loading={historyLoading}
        pagination={{
          current: page,
          pageSize: 5,
          total: totalPages * 5,
          onChange: (p) => fetchHistory(p),
        }}
        extra={
          <Button
            type="primary"
            icon={showForm ? <X size={18} /> : <Plus size={18} />}
            onClick={() => setShowForm(!showForm)}
            danger={showForm}
            className="flex items-center"
          >
            {showForm ? 'Close Form' : 'Create Notification'}
          </Button>
        }
        topSection={topSection}
        showAddButton={false}
      />

      <ConfirmDialog
        title="Confirm Broadcast?"
        description="This will create a single global notification for all users."
        confirmText="Yes, Send!"
        cancelText="Cancel"
        isOpen={sendConfirm.visible}
        onOpenChange={(open) => !open && setSendConfirm({ visible: false, data: null })}
        onConfirm={handleSubmit}
      />
    </div>
  );
};

export default NotificationsPage;
