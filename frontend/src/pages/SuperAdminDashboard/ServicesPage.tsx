import React, { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Table, Button, Card, Space, Tag, Typography, message } from 'antd';
import mainLink from '../../api/mainURLs';
import ConfirmDialog from '../../components/Ui/ConfirmDialog';

const { Title, Text } = Typography;

interface Service {
  _id: string;
  title: string;
  description?: string;
  price: { value?: number; unit?: string } | number;
  duration: { value?: string | number; unit?: string } | string;
  images?: string[];
  image?: string;
  createdAt: string;
}

const ServicesPage: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(6);
  const [loading, setLoading] = useState(true);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await mainLink.get(`/api/admin/services?page=${currentPage}&limit=${limit}`);
      setServices(response.data.services || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const confirmDelete = async () => {
    if (!serviceToDelete) return;

    try {
      await mainLink.delete(`/api/admin/services/${serviceToDelete}`);
      message.success('Service has been removed.');
      fetchServices();
    } catch {
      message.error('Failed to delete service');
    } finally {
      setServiceToDelete(null);
    }
  };

  const displayPrice = (price: any) => {
    if (typeof price === 'object') {
      return `${price.value || 0}${price.unit || 'kr'}`;
    }
    return `${price || 0} kr`;
  };

  const displayDuration = (duration: any) => {
    if (typeof duration === 'object') {
      return `${duration.value || 'N/A'} ${duration.unit || ''}`;
    }
    return duration || 'Fixed';
  };

  const columns = [
    {
      title: 'Image',
      key: 'image',
      render: (_: any, record: Service) => {
        const imageUrl = record.image || (record.images && record.images[0]);
        return imageUrl ? (
          <img src={imageUrl} alt={record.title} className="w-16 h-16 object-cover rounded" />
        ) : (
          <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
            <Text type="secondary" className="text-xs">
              No image
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => desc || 'No description',
      ellipsis: true,
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      render: (price: any) => <Tag color="blue">{displayPrice(price)}</Tag>,
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration: any) => <Tag color="green">{displayDuration(duration)}</Tag>,
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
      render: (_: any, record: Service) => (
        <Button
          type="primary"
          danger
          onClick={() => setServiceToDelete(record._id)}
          className="flex items-center"
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4">
      <Title level={2}>Services</Title>

      <Card title="Services Management" className="shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <Button
            type="primary"
            icon={<Plus size={18} />}
            className="bg-[#2d4a3e] hover:bg-[#233b31] flex items-center"
          >
            Add New
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={services}
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
        title="Delete Service?"
        description="Are you sure you want to remove this service?"
        confirmText="Yes, delete it!"
        cancelText="Cancel"
        variant="destructive"
        isOpen={!!serviceToDelete}
        onOpenChange={(open) => !open && setServiceToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default ServicesPage;
