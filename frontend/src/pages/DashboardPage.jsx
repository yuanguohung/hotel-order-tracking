import React, { useState, useEffect } from "react";
import { adminAPI, ordersAPI } from "../utils/api";
import {
  formatCurrency,
  formatDate,
  getStatusColor,
  getStatusText,
} from "../utils/helpers";
import {
  ShoppingBag,
  Clock,
  CheckCircle,
  DollarSign,
  Users,
  TrendingUp,
  RefreshCw,
} from "lucide-react";

const DashboardPage = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
    // Auto refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setRefreshing(true);

      const [dashboardResponse, ordersResponse] = await Promise.all([
        adminAPI.getDashboard(),
        ordersAPI.getAll({ status: "pending,preparing,ready" }),
      ]);

      setDashboardData(dashboardResponse.data.data);
      setActiveOrders(ordersResponse.data.data);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await ordersAPI.updateStatus(orderId, { status: newStatus });
      loadDashboardData(); // Refresh data
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = [
    {
      name: "Đơn hàng hôm nay",
      value: dashboardData?.today?.totalOrders || 0,
      icon: ShoppingBag,
      color: "bg-blue-500",
    },
    {
      name: "Doanh thu hôm nay",
      value: formatCurrency(dashboardData?.today?.totalRevenue || 0),
      icon: DollarSign,
      color: "bg-green-500",
    },
    {
      name: "Đơn chờ xử lý",
      value: dashboardData?.today?.pendingOrders || 0,
      icon: Clock,
      color: "bg-yellow-500",
    },
    {
      name: "Đơn hoạt động",
      value: activeOrders.length,
      icon: TrendingUp,
      color: "bg-purple-500",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600">
                  Tổng quan hệ thống order khách sạn
                </p>
              </div>
              <button
                onClick={loadDashboardData}
                disabled={refreshing}
                className="btn-primary flex items-center space-x-2"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                <span>Làm mới</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className="card p-6">
              <div className="flex items-center">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    {stat.name}
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Active Orders */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Đơn hàng đang hoạt động ({activeOrders.length})
            </h3>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {activeOrders.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Không có đơn hàng nào
                </p>
              ) : (
                activeOrders.map((order) => (
                  <div
                    key={order.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {order.order_number}
                        </h4>
                        <p className="text-sm text-gray-600">
                          Phòng {order.room_number} - {order.customer_name}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {getStatusText(order.status)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">
                        {formatDate(order.created_at)}
                      </span>
                      <span className="font-semibold text-blue-600">
                        {formatCurrency(order.total_amount)}
                      </span>
                    </div>

                    <div className="mt-3 flex space-x-2">
                      {order.status === "pending" && (
                        <button
                          onClick={() =>
                            handleStatusUpdate(order.id, "preparing")
                          }
                          className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200"
                        >
                          Bắt đầu chuẩn bị
                        </button>
                      )}
                      {order.status === "preparing" && (
                        <button
                          onClick={() => handleStatusUpdate(order.id, "ready")}
                          className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200"
                        >
                          Sẵn sàng
                        </button>
                      )}
                      {order.status === "ready" && (
                        <button
                          onClick={() =>
                            handleStatusUpdate(order.id, "delivered")
                          }
                          className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded hover:bg-gray-200"
                        >
                          Đã giao
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Thống kê theo trạng thái hôm nay
            </h3>

            <div className="space-y-3">
              {dashboardData?.statusBreakdown?.map((stat) => (
                <div
                  key={stat.status}
                  className="flex justify-between items-center"
                >
                  <div className="flex items-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        stat.status
                      )}`}
                    >
                      {getStatusText(stat.status)}
                    </span>
                  </div>
                  <span className="font-semibold">{stat.count}</span>
                </div>
              ))}
            </div>

            {/* Popular Items */}
            <div className="mt-8">
              <h4 className="font-medium text-gray-900 mb-3">
                Món phổ biến hôm nay
              </h4>
              <div className="space-y-2">
                {dashboardData?.popularItems?.slice(0, 5).map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-gray-600">{item.name}</span>
                    <span className="font-medium">{item.total_quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
