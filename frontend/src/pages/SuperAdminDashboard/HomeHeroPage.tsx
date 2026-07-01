import React, { useState, useRef } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  CheckCircle2 as CheckIcon,
  XCircle as XIcon,
  Upload,
  Film,
  Image as ImageIcon,
} from 'lucide-react';
import {
  Table,
  Button,
  Card,
  Space,
  Tag as AntTag,
  Typography,
  Modal,
  Form,
  Input,
  Switch,
  message,
} from 'antd';
import ConfirmDialog from '../../components/Ui/ConfirmDialog';
import {
  useAllHeroes,
  useCreateHeroMutation,
  useUpdateHeroMutation,
  useDeleteHeroMutation,
} from '../../features/homeHero/hooks';

const { Title, Text } = Typography;

const HomeHeroPage: React.FC = () => {
  const { data: heroes = [], isLoading } = useAllHeroes();
  const createMutation = useCreateHeroMutation();
  const updateMutation = useUpdateHeroMutation();
  const deleteMutation = useDeleteHeroMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ visible: boolean; id: string }>({
    visible: false,
    id: '',
  });
  const [form] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const resetForm = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setPreviewUrl(null);
    setSelectedFile(null);
    form.resetFields();
  };

  const handleSubmit = async (values: any) => {
    try {
      const data = new FormData();
      data.append('isActive', String(values.isActive));

      if (selectedFile) {
        data.append('media', selectedFile);
      }

      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, formData: data });
        message.success('Hero oppdatert!');
      } else {
        await createMutation.mutateAsync(data);
        message.success('Hero opprettet!');
      }

      resetForm();
    } catch (err) {
      message.error(editingId ? 'Kunne ikke oppdatere hero' : 'Kunne ikke opprette hero');
    }
  };

  const handleEdit = (hero: any) => {
    setEditingId(hero._id);
    setPreviewUrl(hero.mediaUrl);
    form.setFieldsValue({
      isActive: hero.isActive,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(deleteConfirm.id);
      message.success('Hero slettet');
      setDeleteConfirm({ visible: false, id: '' });
    } catch {
      message.error('Kunne ikke slette hero');
    }
  };

  const isVideo = (url: string) => {
    return url.includes('video') || url.match(/\.(mp4|webm|ogg)$/i);
  };

  const columns = [
    {
      title: 'Media',
      key: 'media',
      render: (_: any, record: any) => (
        <div className="w-24 h-16 overflow-hidden rounded-lg">
          {record.mediaUrl &&
            (isVideo(record.mediaUrl) ? (
              <video
                src={record.mediaUrl}
                className="w-full h-full object-cover"
                muted
                autoPlay
                loop
              />
            ) : (
              <img src={record.mediaUrl} className="w-full h-full object-cover" alt="Hero" />
            ))}
        </div>
      ),
    },
    {
      title: 'Type',
      key: 'type',
      render: (_: any, record: any) => {
        return (
          <AntTag
            icon={record.mediaType === 'video' ? <Film size={12} /> : <ImageIcon size={12} />}
          >
            {record.mediaType || 'Image'}
          </AntTag>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: any) => {
        return (
          <AntTag color={record.isActive ? 'success' : 'default'}>
            {record.isActive ? (
              <Space size="small">
                <CheckIcon size={12} />
                Active
              </Space>
            ) : (
              <Space size="small">
                <XIcon size={12} />
                Inactive
              </Space>
            )}
          </AntTag>
        );
      },
    },
    {
      title: 'Created',
      key: 'created',
      render: (_: any, record: any) => {
        return (
          <Text type="secondary" className="text-xs">
            {new Date(record.createdAt).toLocaleDateString()}
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
            icon={<Edit2 size={16} />}
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
      <Title level={2}>Manage Home Hero</Title>
      <Text type="secondary" className="block mb-8">
        Administrer nettsidens hovedhero-seksjon
      </Text>

      <Card
        title="Hero Banners"
        extra={
          <Button
            type="primary"
            icon={<Plus size={18} />}
            onClick={() => {
              setEditingId(null);
              setIsModalOpen(true);
            }}
            className="flex items-center"
          >
            Add New Hero
          </Button>
        }
        className="shadow-sm"
      >
        <Table
          columns={columns}
          dataSource={heroes}
          rowKey="_id"
          loading={isLoading}
          pagination={false}
        />
      </Card>

      <Modal
        title={editingId ? 'Edit Hero' : 'New Hero'}
        open={isModalOpen}
        onCancel={resetForm}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ isActive: true }}
        >
          <Form.Item name="isActive" label="Set as Active" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="Media (Image/Video)">
            {previewUrl && (
              <div className="mb-4 aspect-video bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                {isVideo(previewUrl) ? (
                  <video
                    src={previewUrl}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                  />
                ) : (
                  <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                )}
              </div>
            )}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-all overflow-hidden relative group"
            >
              <div className="text-center p-8">
                <div className="bg-white p-4 rounded-full shadow-sm mb-4 inline-block">
                  <Upload size={24} className="text-gray-400" />
                </div>
                <Text className="text-gray-500 font-medium">Click to upload image or video</Text>
                <Text type="secondary" className="text-xs mt-2 block">
                  MP4, JPG, PNG, WEBP
                </Text>
              </div>
            </div>
            <input
              title="Upload Media"
              id="media"
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,video/*"
            />
            <Text type="secondary" className="text-xs mt-2 block">
              Note: Titles and subtitles are static in the frontend. Only the media is managed here.
            </Text>
          </Form.Item>

          <Form.Item className="flex justify-end">
            <Space>
              <Button onClick={resetForm}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? 'Update Hero' : 'Save Hero'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <ConfirmDialog
        title="Er du sikker på at du vil slette denne heroen?"
        description="Denne handlingen kan ikke angres."
        confirmText="Ja, slett"
        cancelText="Avbryt"
        variant="destructive"
        isOpen={deleteConfirm.visible}
        onOpenChange={(open) => !open && setDeleteConfirm({ visible: false, id: '' })}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default HomeHeroPage;
