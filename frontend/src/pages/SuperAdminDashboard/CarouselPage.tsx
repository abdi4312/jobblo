import React, { useState } from 'react';
import {
  Upload as UploadIcon,
  CheckCircle2 as ActiveIcon,
  AlertCircle as ExpiredIcon,
  Clock as SoonIcon,
  Edit,
  Trash2,
} from 'lucide-react';
import {
  Button,
  Space,
  Tag as AntTag,
  Typography,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  ColorPicker,
  message,
} from 'antd';
import ConfirmDialog from '../../components/Ui/ConfirmDialog';
import { AdminTable } from '../../components/Ui/AdminTable';
import {
  useAdminHeroes,
  useCreateHero,
  useUpdateHero,
  useDeleteHero,
} from '../../features/hero/hooks';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const CarouselPage: React.FC = () => {
  const { data: heroes = [], isLoading: loading } = useAdminHeroes();
  const createHeroMutation = useCreateHero();
  const updateHeroMutation = useUpdateHero();
  const deleteHeroMutation = useDeleteHero();

  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ visible: boolean; id: string }>({
    visible: false,
    id: '',
  });
  const [form] = Form.useForm();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleEdit = (item: any) => {
    setEditingId(item._id);
    form.setFieldsValue({
      title: item.title || '',
      subtitle: item.subtitle || '',
      buttonText: item.buttonText || '',
      buttonUrl: item.buttonUrl || '',
      footerText: item.footerText || '',
      bgColor: item.bgColor || '#132A22',
      activeFrom: item.activeFrom ? dayjs(item.activeFrom) : null,
      expireAt: item.expireAt ? dayjs(item.expireAt) : null,
    });
    setPreviewUrl(item.image || null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setPreviewUrl(null);
    setSelectedFile(null);
    form.resetFields();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const getStatus = (start: string, end: string) => {
    if (!start || !end)
      return {
        label: 'N/A',
        color: 'default',
        icon: <ExpiredIcon size={12} />,
        dateInfo: 'No Date',
      };
    const now = new Date();
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (now < startDate) {
      return {
        label: 'Coming Soon',
        color: 'orange',
        icon: <SoonIcon size={12} />,
        dateInfo: `Starts: ${startDate.toLocaleDateString()}`,
      };
    } else if (now > endDate) {
      return {
        label: 'Expired',
        color: 'error',
        icon: <ExpiredIcon size={12} />,
        dateInfo: `Expired on: ${endDate.toLocaleDateString()}`,
      };
    } else {
      return {
        label: 'Active',
        color: 'success',
        icon: <ActiveIcon size={12} />,
        dateInfo: `Ends: ${endDate.toLocaleDateString()}`,
      };
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const data = new FormData();
      data.append('title', values.title);
      data.append('subtitle', values.subtitle);
      data.append('buttonText', values.buttonText);
      data.append('buttonUrl', values.buttonUrl);
      data.append('footerText', values.footerText);
      data.append('bgColor', values.bgColor);
      data.append('activeFrom', values.activeFrom ? values.activeFrom.toISOString() : '');
      data.append('expireAt', values.expireAt ? values.expireAt.toISOString() : '');

      if (selectedFile) {
        data.append('image', selectedFile);
      } else if (values.imageUrl) {
        data.append('image', values.imageUrl);
      }

      if (editingId) {
        await updateHeroMutation.mutateAsync({ id: editingId, formData: data });
        message.success('Hero banner er oppdatert');
      } else {
        await createHeroMutation.mutateAsync(data);
        message.success('Hero banner er opprettet');
      }
      closeModal();
    } catch {
      message.error(editingId ? 'Kunne ikke oppdatere hero' : 'Kunne ikke opprette hero');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteHeroMutation.mutateAsync(deleteConfirm.id);
      message.success('Banneret har blitt slettet.');
      setDeleteConfirm({ visible: false, id: '' });
    } catch {
      message.error('Kunne ikke slette banneret');
    }
  };

  const columns = [
    {
      title: 'Banner',
      key: 'banner',
      render: (_: any, record: any) => (
        <Space>
          {record.image && (
            <img src={record.image} alt={record.title} className="w-16 h-10 object-cover rounded" />
          )}
          <Text strong>{record.title || 'Untitled'}</Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: any) => {
        const status = getStatus(record.activeFrom, record.expireAt);
        return (
          <Space>
            <AntTag color={status.color}>
              <Space size="small">
                {status.icon}
                {status.label}
              </Space>
            </AntTag>
          </Space>
        );
      },
    },
    {
      title: 'Date Info',
      key: 'date',
      render: (_: any, record: any) => {
        const status = getStatus(record.activeFrom, record.expireAt);
        return (
          <Text type="secondary" className="text-xs">
            {status.dateInfo}
          </Text>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="primary"
            icon={<Edit size={16} />}
            onClick={() => handleEdit(record)}
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
      <Title level={2}>Carousel Management</Title>
      <Text type="secondary" className="block mb-8">
        Administrer nettsidens hovedbannere
      </Text>

      <AdminTable
        title="Banners"
        columns={columns}
        dataSource={heroes}
        rowKey="_id"
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize: itemsPerPage,
          total: heroes.length,
          onChange: (p) => setCurrentPage(p),
        }}
        extra={
          <Button
            type="primary"
            icon={<UploadIcon size={18} />}
            onClick={() => {
              setEditingId(null);
              setShowModal(true);
            }}
            className="flex items-center"
          >
            Upload New Banner
          </Button>
        }
        showAddButton={false}
      />

      <Modal
        title={editingId ? 'Edit Banner' : 'Upload New Banner'}
        open={showModal}
        onCancel={closeModal}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ bgColor: '#132A22' }}
        >
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Banner title" />
          </Form.Item>

          <Form.Item name="subtitle" label="Subtitle">
            <Input placeholder="Banner subtitle" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="buttonText" label="Button Text">
              <Input placeholder="Learn more" />
            </Form.Item>

            <Form.Item name="buttonUrl" label="Button URL">
              <Input placeholder="https://example.com" />
            </Form.Item>
          </div>

          <Form.Item name="footerText" label="Footer Text">
            <Input placeholder="Banner footer text" />
          </Form.Item>

          <Form.Item name="bgColor" label="Background Color">
            <ColorPicker format="hex" showText />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="activeFrom" label="Active From">
              <DatePicker className="w-full" />
            </Form.Item>

            <Form.Item name="expireAt" label="Expires At">
              <DatePicker className="w-full" />
            </Form.Item>
          </div>

          <Form.Item label="Banner Image">
            {previewUrl && (
              <div className="mb-4">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-40 object-cover rounded-lg"
                />
              </div>
            )}
            <Input type="file" onChange={handleFileChange} accept="image/*" />
            <Text type="secondary" className="text-xs mt-2 block">
              Select an image for your banner
            </Text>
          </Form.Item>

          <Form.Item className="flex justify-end">
            <Space>
              <Button onClick={closeModal}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createHeroMutation.isPending || updateHeroMutation.isPending}
              >
                {editingId ? 'Update Banner' : 'Create Banner'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <ConfirmDialog
        title="Er du sikker?"
        description="Du vil ikke kunne angre dette!"
        confirmText="Ja, slett den!"
        cancelText="Avbryt"
        variant="destructive"
        isOpen={deleteConfirm.visible}
        onOpenChange={(open) => !open && setDeleteConfirm({ visible: false, id: '' })}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default CarouselPage;
