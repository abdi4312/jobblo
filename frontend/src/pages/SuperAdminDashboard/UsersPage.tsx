import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Calendar, Search } from 'lucide-react';
import {
  Table,
  Button,
  Card,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  message,
} from 'antd';
import mainLink from '../../api/mainURLs';
import ConfirmDialog from '../../components/Ui/ConfirmDialog';

const { Title, Text } = Typography;
const { Option } = Select;

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  createdAt: string;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend: string;
}

const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedRole, setDebouncedRole] = useState('');
  const [stats, setStats] = useState({ total: 0, new: 0, activeMonth: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'user',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ visible: boolean; userId: string }>({
    visible: false,
    userId: '',
  });
  const [roleChangeConfirm, setRoleChangeConfirm] = useState<{
    visible: boolean;
    userId: string;
    newRole: string;
  }>({ visible: false, userId: '', newRole: '' });
  const [form] = Form.useForm();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await mainLink.get(
        `/api/admin/users?page=${currentPage}&limit=${limit}&search=${debouncedSearch}&role=${debouncedRole}`
      );
      setUsers(response.data.users || []);
      setTotalPages(response.data.totalPages || 1);
      setStats({
        total: response.data.totalUsers || 0,
        activeMonth: response.data.activeThisMonth || 0,
        new: (response.data.users || []).filter(
          (u: User) => new Date(u.createdAt).toDateString() === new Date().toDateString()
        ).length,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, debouncedSearch, debouncedRole]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setDebouncedRole(roleFilter);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, roleFilter]);

  const handleCreateUser = async (values: any) => {
    setIsSubmitting(true);
    try {
      await mainLink.post('/api/admin/users', values);
      message.success('New user has been created.');
      setIsModalOpen(false);
      fetchUsers();
      form.resetFields();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      message.error(error.response?.data?.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async () => {
    try {
      await mainLink.put(`/api/admin/users/${roleChangeConfirm.userId}/role`, {
        role: roleChangeConfirm.newRole,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u._id === roleChangeConfirm.userId ? { ...u, role: roleChangeConfirm.newRole } : u
        )
      );
      message.success('User role changed.');
      setRoleChangeConfirm({ visible: false, userId: '', newRole: '' });
    } catch {
      message.error('Failed to update role');
    }
  };

  const handleDelete = async () => {
    try {
      await mainLink.delete(`/api/admin/users/${deleteConfirm.userId}`);
      fetchUsers();
      message.success('User removed.');
      setDeleteConfirm({ visible: false, userId: '' });
    } catch {
      message.error('Delete failed');
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => phone || '-',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string, record: User) => (
        <Space direction="vertical" size={0}>
          <Tag color={role === 'superAdmin' ? 'red' : role === 'admin' ? 'blue' : 'green'}>
            {role.toUpperCase()}
          </Tag>
          <Select
            defaultValue={role}
            style={{ width: 120 }}
            size="small"
            onChange={(newRole) =>
              setRoleChangeConfirm({ visible: true, userId: record._id, newRole })
            }
          >
            <Option value="user">User</Option>
            <Option value="provider">Provider</Option>
            <Option value="admin">Admin</Option>
            <Option value="superAdmin">Super Admin</Option>
          </Select>
        </Space>
      ),
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
      render: (_: any, record: User) => (
        <Button
          type="primary"
          danger
          icon={<Users size={16} className="mr-2" />}
          onClick={() => setDeleteConfirm({ visible: true, userId: record._id })}
          className="flex items-center"
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4">
      <Title level={2}>Users Overview</Title>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          icon={<Users className="text-orange-500" />}
          label="Total Users"
          value={stats.total.toLocaleString()}
          trend="8.5%"
        />
        <StatCard
          icon={<UserPlus className="text-blue-500" />}
          label="Today's New"
          value={stats.new}
          trend="Live"
        />
        <StatCard
          icon={<Calendar className="text-green-600" />}
          label="Active This Month"
          value={stats.activeMonth}
          trend="Live"
        />
      </div>

      <Card title="User Management" className="shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm w-full outline-none focus:border-[#2d4a3e]"
              />
            </div>
            <Select
              placeholder="All Roles"
              value={roleFilter || undefined}
              onChange={setRoleFilter}
              style={{ width: 150 }}
            >
              <Option value="">All Roles</Option>
              <Option value="user">User</Option>
              <Option value="provider">Provider</Option>
              <Option value="superAdmin">Super Admin</Option>
            </Select>
          </div>
          <Button
            type="primary"
            icon={<UserPlus size={18} />}
            onClick={() => setIsModalOpen(true)}
            className="bg-[#2d4a3e] hover:bg-[#233b31] flex items-center"
          >
            Add New User
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={users}
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

      <Modal
        title="Add New User"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateUser}
          initialValues={{ role: 'user' }}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select>
              <Option value="user">User</Option>
              <Option value="provider">Provider</Option>
              <Option value="admin">Admin</Option>
              <Option value="superAdmin">Super Admin</Option>
            </Select>
          </Form.Item>
          <Form.Item className="flex justify-end">
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={isSubmitting}>
                Create User
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <ConfirmDialog
        title="Update User Role?"
        description={`Change role to ${roleChangeConfirm.newRole.toUpperCase()}?`}
        confirmText="Yes, Update"
        cancelText="Cancel"
        isOpen={roleChangeConfirm.visible}
        onOpenChange={(open) =>
          !open && setRoleChangeConfirm({ visible: false, userId: '', newRole: '' })
        }
        onConfirm={handleRoleChange}
      />

      <ConfirmDialog
        title="Are you sure?"
        description="Permanent delete!"
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="destructive"
        isOpen={deleteConfirm.visible}
        onOpenChange={(open) => !open && setDeleteConfirm({ visible: false, userId: '' })}
        onConfirm={handleDelete}
      />
    </div>
  );
};

const StatCard = ({ icon, label, value, trend }: StatCardProps) => (
  <div className="bg-white p-6 rounded-[2.5rem] flex justify-between items-center shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div className="flex items-center gap-4">
      <div className="p-4 bg-gray-50 rounded-[1.25rem]">{icon}</div>
      <div>
        <p className="text-2xl font-black text-gray-800 leading-none mb-1">{value}</p>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{label}</p>
      </div>
    </div>
    <div className="text-green-500 font-black text-xs self-start mt-1">↗ {trend}</div>
  </div>
);

export default UsersPage;
