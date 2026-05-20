import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  Card,
  Space,
  Divider,
  Typography,
  Tag,
  message,
} from "antd";
import {
  Edit,
  ShieldCheck,
  Eye,
  Users,
  CreditCard,
  Settings,
  Info,
  Trash2,
  Plus,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getPlans,
  updatePlan,
  getConfigs,
  updateConfig,
  initializeConfigs,
} from "../../features/plans/api";

const { Title, Text } = Typography;

const PlansAdminPage: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansData, configsData] = await Promise.all([
        getPlans(),
        getConfigs(),
      ]);
      setPlans(plansData);
      setConfigs(configsData);

      // If no configs, try to initialize
      if (configsData.length === 0) {
        await initializeConfigs();
        const newConfigs = await getConfigs();
        setConfigs(newConfigs);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      message.error("Kunne ikke hente data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (plan: any) => {
    setEditingPlan(plan);
    form.setFieldsValue({
      name: plan.name,
      price: plan.price,
      type: plan.type,
      isActive: plan.isActive,
      freeContact: plan.entitlements.freeContact,
      radius: plan.entitlements.radius,
      visibilityLevel: plan.entitlements.visibilityLevel,
      locationPrecision: plan.entitlements.locationPrecision,
      hasBadge: plan.entitlements.hasBadge,
      hasAnalytics: plan.entitlements.hasAnalytics,
      featuresText: plan.featuresText || [],
    });
    setIsModalOpen(true);
  };

  const handleUpdatePlan = async (values: any) => {
    try {
      const updatedPlan = {
        name: values.name,
        price: values.price,
        type: values.type,
        isActive: values.isActive,
        featuresText: values.featuresText || [],
        entitlements: {
          ...editingPlan.entitlements,
          freeContact: values.freeContact,
          radius: values.radius,
          visibilityLevel: values.visibilityLevel,
          locationPrecision: values.locationPrecision,
          hasBadge: values.hasBadge,
          hasAnalytics: values.hasAnalytics,
        },
      };
      await updatePlan(editingPlan._id, updatedPlan);
      message.success("Plan oppdatert");

      // Invalidate queries to refresh Pricing page and other components
      queryClient.invalidateQueries({ queryKey: ["plans"] });

      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      message.error("Kunne ikke oppdatere plan");
    }
  };

  const handleToggleConfig = async (key: string, value: boolean) => {
    try {
      await updateConfig(key, value);
      message.success("Innstilling oppdatert");
      fetchData();
    } catch (error) {
      message.error("Kunne ikke oppdatere innstilling");
    }
  };

  const columns = [
    {
      title: "Plan Name",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Tag color={record.type === "business" ? "blue" : "green"}>
            {record.type.toUpperCase()}
          </Tag>
        </Space>
      ),
    },
    {
      title: "Price (NOK)",
      dataIndex: "price",
      key: "price",
      render: (price: number) => `${price} NOK`,
    },
    {
      title: "Contacts/Month",
      dataIndex: ["entitlements", "freeContact"],
      key: "freeContact",
    },
    {
      title: "Visibility",
      dataIndex: ["entitlements", "visibilityLevel"],
      key: "visibilityLevel",
      render: (level: number) => <Tag color="purple">Level {level}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      render: (active: boolean) => (
        <Tag color={active ? "success" : "error"}>
          {active ? "Active" : "Inactive"}
        </Tag>
      ),
    },
    {
      title: "Action",
      key: "action",
      render: (_: any, record: any) => (
        <Button
          type="primary"
          icon={<Edit size={16} className="mr-2" />}
          onClick={() => handleEdit(record)}
          className="flex items-center"
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4">
      <Title level={2}>Plan & Feature Management</Title>

      <Card title="Global Feature Toggles" className="mb-8 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {configs.map((config) => (
            <div
              key={config.key}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div>
                <Text strong className="block">
                  {config.key.replace(/_/g, " ")}
                </Text>
                <Text type="secondary" size="small">
                  {config.description}
                </Text>
              </div>
              <Switch
                checked={config.value}
                onChange={(checked) => handleToggleConfig(config.key, checked)}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Subscription Plans" className="shadow-sm">
        <Table
          columns={columns}
          dataSource={plans}
          rowKey="_id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={`Edit Plan: ${editingPlan?.name}`}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdatePlan}
          initialValues={{ isActive: true }}
        >
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="name"
              label="Plan Name"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="price"
              label="Price (NOK)"
              rules={[{ required: true }]}
            >
              <InputNumber className="w-full" min={0} />
            </Form.Item>
            <Form.Item name="type" label="Type" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="private">Private</Select.Option>
                <Select.Option value="business">Business</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="isActive" label="Status" valuePropName="checked">
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </div>

          <Divider orientation="left">Entitlements & Features</Divider>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="freeContact"
              label="Free Contacts/Month"
              rules={[{ required: true }]}
            >
              <InputNumber className="w-full" min={0} />
            </Form.Item>
            <Form.Item
              name="radius"
              label="Search Radius (km)"
              rules={[{ required: true }]}
            >
              <InputNumber className="w-full" min={0} />
            </Form.Item>
            <Form.Item name="visibilityLevel" label="Visibility Weight (0-5)">
              <InputNumber className="w-full" min={0} max={5} />
            </Form.Item>
            <Form.Item name="locationPrecision" label="Location Precision">
              <Select>
                <Select.Option value="approximate">Approximate</Select.Option>
                <Select.Option value="exact">Exact</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <Form.Item
              name="hasBadge"
              label="Verified Badge"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name="hasAnalytics"
              label="Dashboard Analytics"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </div>

          <Form.Item
            label={
              <Space>
                Plan Features (Displayed to users)
                <Text
                  type="secondary"
                  style={{ fontSize: "12px", fontWeight: "normal" }}
                >
                  <Info size={12} className="inline mr-1" />
                  Edit these lines to change what users see on the pricing page.
                </Text>
              </Space>
            }
          >
            <Form.List name="featuresText">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space
                      key={key}
                      style={{ display: "flex", marginBottom: 8 }}
                      align="baseline"
                    >
                      <Form.Item
                        {...restField}
                        name={[name]}
                        rules={[
                          { required: true, message: "Missing feature text" },
                        ]}
                        style={{ marginBottom: 0, width: "450px" }}
                      >
                        <Input placeholder="e.g. 5 gratis kontakter" />
                      </Form.Item>
                      <Button
                        type="text"
                        danger
                        onClick={() => remove(name)}
                        icon={<Trash2 size={16} />}
                      />
                    </Space>
                  ))}
                  <Form.Item>
                    <Button
                      type="dashed"
                      onClick={() => add()}
                      block
                      icon={<Plus size={16} className="mr-2" />}
                      className="flex items-center justify-center"
                    >
                      Add Feature Line
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>

          <Form.Item className="mt-6 flex justify-end">
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Save Changes
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PlansAdminPage;
