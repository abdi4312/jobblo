import React, { useState } from 'react';
import { ListPlus, Trash2, Edit3, Loader2 } from 'lucide-react';
import {
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Progress,
} from 'antd';
import ConfirmDialog from '../../components/Ui/ConfirmDialog';
import { AdminTable } from '../../components/Ui/AdminTable';
import {
  useRoadmapFeatures,
  useCreateRoadmapFeature,
  useUpdateRoadmapFeature,
  useDeleteRoadmapFeature,
} from '../../features/roadMap/hooks/useRoadmap';
import type { RoadmapFeature, RoadmapFeatureInput } from '../../features/roadMap/types/roadmap';

const { Title, Text } = Typography;
const { Option } = Select;

const RoadmapAdminPage = () => {
  const { data: features = [], isLoading: loading } = useRoadmapFeatures();
  const createMutation = useCreateRoadmapFeature();
  const updateMutation = useUpdateRoadmapFeature();
  const deleteMutation = useDeleteRoadmapFeature();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<RoadmapFeature | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ visible: boolean; id: string }>({
    visible: false,
    id: '',
  });
  const [form] = Form.useForm();

  const handleOpenModal = (feature: RoadmapFeature | null = null) => {
    if (feature) {
      setEditingFeature(feature);
      form.setFieldsValue({
        title: feature.title,
        description: feature.description,
        status: feature.status,
        tag: feature.tag,
        progress: feature.progress,
      });
    } else {
      setEditingFeature(null);
      form.resetFields();
      form.setFieldsValue({
        status: 'planned',
        tag: 'feature',
        progress: 0,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (values: RoadmapFeatureInput) => {
    try {
      if (editingFeature) {
        await updateMutation.mutateAsync({ id: editingFeature._id, data: values });
        message.success('Feature updated.');
      } else {
        await createMutation.mutateAsync(values);
        message.success('New feature added.');
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      message.error(error.response?.data?.error || 'Action failed');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(deleteConfirm.id);
      message.success('Feature has been removed.');
      setDeleteConfirm({ visible: false, id: '' });
    } catch {
      message.error('Deletion failed');
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in-progress':
        return 'processing';
      default:
        return 'default';
    }
  };

  const columns = [
    {
      title: 'Feature',
      key: 'feature',
      render: (_: any, record: RoadmapFeature) => (
        <Space direction="vertical" size="small">
          <Text strong>{record.title}</Text>
          <Text type="secondary" className="text-xs">
            {record.description}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)} className="uppercase text-[10px] font-bold">
          {status}
        </Tag>
      ),
    },
    {
      title: 'Tag',
      dataIndex: 'tag',
      key: 'tag',
      render: (tag: string) => (
        <Tag className="uppercase text-[10px] font-bold text-gray-400 italic">{tag}</Tag>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_: any, record: RoadmapFeature) => (
        <Space align="center">
          <Progress percent={record.progress} size="small" strokeColor="#2d4a3e" />
          <Text strong className="text-xs">
            {record.progress}%
          </Text>
        </Space>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: RoadmapFeature) => (
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
            onClick={() => setDeleteConfirm({ visible: true, id: record._id })}
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
      <Title level={2}>Roadmap Management</Title>

      <AdminTable
        title="Roadmap"
        columns={columns}
        dataSource={features}
        rowKey="_id"
        loading={loading}
        pagination={false}
        onAddButtonClick={() => handleOpenModal()}
        addButtonText="Add New Entry"
      />

      <Modal
        title={editingFeature ? 'Edit Feature' : 'Add New Feature'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            status: 'planned',
            tag: 'feature',
            progress: 0,
          }}
        >
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="E.g. Chat Improvements" />
          </Form.Item>

          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="Detailed description..." />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select>
                <Option value="planned">Planned</Option>
                <Option value="in-progress">In Progress</Option>
                <Option value="completed">Completed</Option>
              </Select>
            </Form.Item>

            <Form.Item name="tag" label="Tag" rules={[{ required: true }]}>
              <Select>
                <Option value="feature">Feature</Option>
                <Option value="bugfix">Bugfix</Option>
                <Option value="improvement">Improvement</Option>
                <Option value="security">Security</Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item name="progress" label="Progress">
            <InputNumber min={0} max={100} className="w-full" addonAfter="%" />
          </Form.Item>

          <Form.Item className="flex justify-end">
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={isSubmitting}>
                {editingFeature ? 'Update Feature' : 'Add Feature'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <ConfirmDialog
        title="Are you sure?"
        description="You cannot undo this!"
        confirmText="Yes, delete it!"
        cancelText="Cancel"
        variant="destructive"
        isOpen={deleteConfirm.visible}
        onOpenChange={(open) => !open && setDeleteConfirm({ visible: false, id: '' })}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default RoadmapAdminPage;
